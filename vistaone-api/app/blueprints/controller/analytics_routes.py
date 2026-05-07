"""Analytics summary endpoint.

The Analytics page used to fetch every ticket, vendor, invoice, work
order, and MSA and aggregate them in JavaScript. For larger clients
that meant pulling thousands of rows on every page load. This endpoint
runs all of those aggregations on the backend (mostly via SQL GROUP
BY) and returns one small JSON payload the page can render directly.

Returned fields:
- kpis: total_tickets, approved, rejected, approval_rate, vendor_count,
  active_wo
- invoice_pipeline: counts + amounts per invoice status
- vendor_ticket_stats: per-vendor ticket counts + rejection rate +
  avg approval hours
- invoice_by_vendor: per-vendor invoice counts + approval rate
- invoice_outstanding: per-vendor unpaid + non-rejected invoice totals
- cost_by_service: spend buckets per work-order service type
- wo_by_status: work order counts per status
- msas_expiring: MSAs expiring in the next 90 days
- vendors_by_shared_service: services offered by 2+ vendors

All views are scoped to the caller's client_id from the JWT.
"""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify
from sqlalchemy import func, select

from app.extensions import db
from app.models.invoice import Invoice
from app.models.msa import Msa
from app.models.service import Service
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.models.vendor_service import VendorService
from app.models.workorder import WorkOrder
from app.utils.util import permission_required, get_current_user_client_id


analytics_bp = Blueprint("analytics_bp", __name__)


def _vendor_label(v):
    if not v:
        return None
    return v.company_name or getattr(v, "name", None)


@analytics_bp.route("/summary", methods=["GET"])
@permission_required("workorders", "read")
def analytics_summary(current_user_id):
    client_id = get_current_user_client_id()

    # ---- Headline KPIs ----------------------------------------------------
    # Tickets are scoped to the client by joining through their work order.
    ticket_status_rows = db.session.execute(
        select(Ticket.status, func.count(Ticket.id))
        .join(WorkOrder, Ticket.work_order_id == WorkOrder.id)
        .where(WorkOrder.client_id == client_id)
        .group_by(Ticket.status)
    ).all()
    ticket_counts_by_status = {
        (s.value if s is not None else "UNKNOWN"): int(c)
        for s, c in ticket_status_rows
    }
    total_tickets = sum(ticket_counts_by_status.values())
    approved_tickets = ticket_counts_by_status.get("APPROVED", 0)
    rejected_tickets = ticket_counts_by_status.get("REJECTED", 0)
    reviewed = approved_tickets + rejected_tickets
    approval_rate = (approved_tickets / reviewed) if reviewed else 0.0

    vendor_count = int(
        db.session.execute(select(func.count(Vendor.id))).scalar() or 0
    )

    active_wo = int(
        db.session.execute(
            select(func.count(WorkOrder.id))
            .where(WorkOrder.client_id == client_id)
            .where(WorkOrder.current_status.notin_(("CANCELLED", "CLOSED")))
        ).scalar()
        or 0
    )

    # ---- Invoice pipeline (counts + amounts per status) -------------------
    inv_status_rows = db.session.execute(
        select(
            Invoice.invoice_status,
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total_amount), 0),
        )
        .where(Invoice.client_id == client_id)
        .group_by(Invoice.invoice_status)
    ).all()
    pipeline_template = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"]
    invoice_pipeline = {
        # Frontend keys are lowercase to match the existing analytics shape.
        s.lower(): {"count": 0, "amount": 0.0} for s in pipeline_template
    }
    # Frontend also reads a `pending` slot that historically combined
    # SUBMITTED-style invoices. Mirror that for compatibility.
    invoice_pipeline["pending"] = {"count": 0, "amount": 0.0}
    for status, count, amount in inv_status_rows:
        key = (status.value if status is not None else "").lower()
        if key in invoice_pipeline:
            invoice_pipeline[key]["count"] = int(count)
            invoice_pipeline[key]["amount"] = float(amount or 0)
    # `pending` mirrors `submitted` so the existing UI labels keep working.
    invoice_pipeline["pending"] = dict(invoice_pipeline["submitted"])

    # ---- Vendor lookup (single fetch reused below) ------------------------
    vendor_rows = db.session.execute(select(Vendor)).scalars().all()
    vendors_by_id = {v.id: v for v in vendor_rows}

    # ---- vendor_ticket_stats ---------------------------------------------
    # Group tickets by (vendor, status) and compute avg approval seconds for
    # APPROVED rows that have both timestamps.
    rows = db.session.execute(
        select(
            Ticket.vendor_id,
            Ticket.status,
            func.count(Ticket.id),
            func.avg(
                func.extract("epoch", Ticket.approved_at - Ticket.created_at)
            ).label("avg_secs"),
        )
        .join(WorkOrder, Ticket.work_order_id == WorkOrder.id)
        .where(WorkOrder.client_id == client_id)
        .where(Ticket.vendor_id.isnot(None))
        .group_by(Ticket.vendor_id, Ticket.status)
    ).all()
    vendor_buckets = {}
    for vendor_id, status, count, avg_secs in rows:
        slot = vendor_buckets.setdefault(
            vendor_id,
            {
                "approved": 0, "rejected": 0, "pending": 0,
                "total": 0, "avg_approval_secs": None,
            },
        )
        s = status.value if status is not None else "UNKNOWN"
        slot["total"] += int(count)
        if s == "APPROVED":
            slot["approved"] = int(count)
            if avg_secs is not None:
                slot["avg_approval_secs"] = float(avg_secs)
        elif s == "REJECTED":
            slot["rejected"] = int(count)
        elif s == "PENDING_APPROVAL":
            slot["pending"] = int(count)
    vendor_ticket_stats = []
    for vid, slot in vendor_buckets.items():
        v = vendors_by_id.get(vid)
        reviewed_v = slot["approved"] + slot["rejected"]
        rejection_rate = (slot["rejected"] / reviewed_v) if reviewed_v else 0.0
        avg_hours = (
            slot["avg_approval_secs"] / 3600.0
            if slot["avg_approval_secs"] is not None
            else None
        )
        vendor_ticket_stats.append({
            "vendor_id": vid,
            "vendor_name": _vendor_label(v) or vid[:8],
            "total": slot["total"],
            "approved": slot["approved"],
            "rejected": slot["rejected"],
            "pending": slot["pending"],
            "rejection_rate": rejection_rate,
            "avg_approval_hours": avg_hours,
        })
    vendor_ticket_stats.sort(
        key=lambda r: (r["rejection_rate"], r["rejected"]), reverse=True,
    )

    # ---- invoice_by_vendor + invoice_outstanding -------------------------
    inv_by_vendor_rows = db.session.execute(
        select(
            Invoice.vendor_id,
            Invoice.invoice_status,
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total_amount), 0),
        )
        .where(Invoice.client_id == client_id)
        .where(Invoice.vendor_id.isnot(None))
        .group_by(Invoice.vendor_id, Invoice.invoice_status)
    ).all()
    inv_buckets = {}
    for vendor_id, status, count, amount in inv_by_vendor_rows:
        s = (status.value if status is not None else "")
        slot = inv_buckets.setdefault(
            vendor_id,
            {
                "approved": 0, "rejected": 0, "pending": 0, "paid": 0,
                "draft": 0, "submitted": 0,
                "outstanding_count": 0, "outstanding_amount": 0.0,
            },
        )
        c = int(count)
        amt = float(amount or 0)
        if s == "APPROVED":
            slot["approved"] = c
        elif s == "REJECTED":
            slot["rejected"] = c
        elif s == "SUBMITTED":
            slot["submitted"] = c
            slot["pending"] = c
        elif s == "PAID":
            slot["paid"] = c
        elif s == "DRAFT":
            slot["draft"] = c
        # Outstanding = unpaid + non-rejected, mirroring the JS helper.
        if s not in ("PAID", "REJECTED"):
            slot["outstanding_count"] += c
            slot["outstanding_amount"] += amt

    invoice_by_vendor = []
    invoice_outstanding = []
    for vid, slot in inv_buckets.items():
        v = vendors_by_id.get(vid)
        name = _vendor_label(v) or vid[:8]
        reviewed_v = slot["approved"] + slot["rejected"]
        approval_rate_v = (slot["approved"] / reviewed_v) if reviewed_v else None
        total_v = slot["approved"] + slot["rejected"] + slot["pending"]
        invoice_by_vendor.append({
            "vendor_id": vid,
            "vendor_name": name,
            "approved": slot["approved"],
            "rejected": slot["rejected"],
            "pending": slot["pending"],
            "total": total_v,
            "approval_rate": approval_rate_v,
        })
        if slot["outstanding_count"]:
            invoice_outstanding.append({
                "vendor_id": vid,
                "vendor_name": name,
                "count": slot["outstanding_count"],
                "amount": slot["outstanding_amount"],
            })
    invoice_by_vendor.sort(key=lambda r: r["total"], reverse=True)
    invoice_outstanding.sort(key=lambda r: r["amount"], reverse=True)

    # ---- cost_by_service --------------------------------------------------
    # Each invoice rolls up to the work-order's service. We fetch the
    # service name once and key the bucket by it.
    cost_rows = db.session.execute(
        select(
            Service.service,
            Invoice.invoice_status,
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total_amount), 0),
        )
        .join(WorkOrder, Invoice.work_order_id == WorkOrder.id)
        .join(Service, WorkOrder.service_type == Service.id, isouter=True)
        .where(Invoice.client_id == client_id)
        .group_by(Service.service, Invoice.invoice_status)
    ).all()
    cost_buckets = {}
    for service_name, status, count, amount in cost_rows:
        key = service_name or "Unknown"
        slot = cost_buckets.setdefault(
            key,
            {
                "service": key, "invoice_count": 0, "total": 0.0,
                "approved": 0.0, "pending": 0.0, "rejected": 0.0, "paid": 0.0,
            },
        )
        c = int(count)
        amt = float(amount or 0)
        slot["invoice_count"] += c
        slot["total"] += amt
        s = (status.value if status is not None else "")
        if s == "APPROVED":
            slot["approved"] += amt
        elif s == "SUBMITTED":
            slot["pending"] += amt
        elif s == "REJECTED":
            slot["rejected"] += amt
        elif s == "PAID":
            slot["paid"] += amt
    cost_by_service = sorted(
        cost_buckets.values(), key=lambda r: r["total"], reverse=True,
    )

    # ---- wo_by_status -----------------------------------------------------
    wo_rows = db.session.execute(
        select(WorkOrder.current_status, func.count(WorkOrder.id))
        .where(WorkOrder.client_id == client_id)
        .group_by(WorkOrder.current_status)
    ).all()
    wo_by_status = [
        {
            "status": (s.value if s is not None else "UNKNOWN"),
            "count": int(c),
        }
        for s, c in wo_rows
    ]

    # ---- msas_expiring ----------------------------------------------------
    today = datetime.utcnow().date()
    cutoff = today + timedelta(days=90)
    msas = db.session.execute(select(Msa)).scalars().all()
    msas_expiring = []
    for m in msas:
        ed = getattr(m, "expiration_date", None)
        if not ed:
            continue
        ed_d = ed.date() if hasattr(ed, "date") else ed
        if not (today <= ed_d <= cutoff):
            continue
        v = vendors_by_id.get(m.vendor_id)
        msas_expiring.append({
            "id": m.id,
            "vendor_id": m.vendor_id,
            "vendor_name": _vendor_label(v),
            "version": getattr(m, "version", None),
            "expiration_date": ed.isoformat() if hasattr(ed, "isoformat") else str(ed),
        })
    msas_expiring.sort(key=lambda r: r["expiration_date"])

    # ---- vendors_by_shared_service ---------------------------------------
    # Services offered by two or more vendors via vendor_service rows.
    shared_rows = db.session.execute(
        select(Service.service, Vendor.company_name, Vendor.id)
        .join(VendorService, VendorService.service_id == Service.id)
        .join(Vendor, Vendor.id == VendorService.vendor_id)
    ).all()
    by_service = {}
    for service_name, company_name, _vid in shared_rows:
        if not service_name:
            continue
        by_service.setdefault(service_name, set()).add(
            company_name or "Unknown vendor"
        )
    vendors_by_shared_service = sorted(
        (
            {"service": svc, "vendors": sorted(names)}
            for svc, names in by_service.items()
            if len(names) >= 2
        ),
        key=lambda r: len(r["vendors"]),
        reverse=True,
    )

    return (
        jsonify({
            "kpis": {
                "total_tickets": total_tickets,
                "approved": approved_tickets,
                "rejected": rejected_tickets,
                "approval_rate": approval_rate,
                "vendor_count": vendor_count,
                "active_wo": active_wo,
            },
            "invoice_pipeline": invoice_pipeline,
            "vendor_ticket_stats": vendor_ticket_stats,
            "invoice_by_vendor": invoice_by_vendor,
            "invoice_outstanding": invoice_outstanding,
            "cost_by_service": cost_by_service,
            "wo_by_status": wo_by_status,
            "msas_expiring": msas_expiring,
            "vendors_by_shared_service": vendors_by_shared_service,
        }),
        200,
    )
