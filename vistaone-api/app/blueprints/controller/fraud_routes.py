"""Fraud & Anomalies endpoint.

Compiles fraud / anomaly alerts for the caller's client and groups them
by work order so the Fraud page can show ops which jobs are flagged
and where the alerts came from. Sources:

- contractor app (Ticket.anomaly_flag = true) -> per-ticket alert
- vendor (rejected invoices on this client's WOs)            -> per-invoice
- system  (derived signals across the client's data)         -> per-WO

Alerts are scoped to the caller's client_id from the JWT. No schema
changes; all signals come from columns that already exist
(Ticket.anomaly_flag, Ticket.anomaly_reason, Invoice.invoice_status,
Msa.expiration_date, Vendor.compliance_status).
"""
from datetime import datetime
from collections import defaultdict

from flask import Blueprint, jsonify
from sqlalchemy import select

from app.extensions import db
from app.models.invoice import Invoice
from app.models.msa import Msa
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.models.workorder import WorkOrder
from app.utils.util import permission_required, get_current_user_client_id


fraud_bp = Blueprint("fraud_bp", __name__)


REJECTION_RATE_THRESHOLD = 0.3  # 30%+ of reviewed tickets rejected


def _vendor_label(v):
    if not v:
        return None
    return v.company_name or getattr(v, "name", None)


def _enum_value(v):
    if v is None:
        return None
    return getattr(v, "value", v)


def _iso(dt):
    if not dt:
        return None
    return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)


@fraud_bp.route("/alerts", methods=["GET"])
@permission_required("workorders", "read")
def fraud_alerts(current_user_id):
    client_id = get_current_user_client_id()

    # ---- Pull the client's data (single round trip per table) ------------
    work_orders = (
        db.session.execute(
            select(WorkOrder).where(WorkOrder.client_id == client_id)
        )
        .scalars()
        .all()
    )
    wo_ids = [w.id for w in work_orders]
    wo_by_id = {w.id: w for w in work_orders}

    if wo_ids:
        tickets = (
            db.session.execute(
                select(Ticket).where(Ticket.work_order_id.in_(wo_ids))
            )
            .scalars()
            .all()
        )
        invoices = (
            db.session.execute(
                select(Invoice).where(Invoice.work_order_id.in_(wo_ids))
            )
            .scalars()
            .all()
        )
    else:
        tickets, invoices = [], []

    vendors = db.session.execute(select(Vendor)).scalars().all()
    vendors_by_id = {v.id: v for v in vendors}

    msas = db.session.execute(select(Msa)).scalars().all()
    msas_by_vendor = defaultdict(list)
    for m in msas:
        if m.vendor_id:
            msas_by_vendor[m.vendor_id].append(m)

    # ---- Pre-compute helper indices --------------------------------------
    tickets_by_wo = defaultdict(list)
    for t in tickets:
        tickets_by_wo[t.work_order_id].append(t)

    invoices_by_wo = defaultdict(list)
    for inv in invoices:
        invoices_by_wo[inv.work_order_id].append(inv)

    # Per-vendor ticket review rates across the client (used for the
    # "high rejection rate" derived signal on every WO that vendor owns).
    vendor_review_counts = defaultdict(lambda: {"approved": 0, "rejected": 0})
    for t in tickets:
        if not t.vendor_id:
            continue
        s = _enum_value(getattr(t, "status", None))
        if s == "APPROVED":
            vendor_review_counts[t.vendor_id]["approved"] += 1
        elif s == "REJECTED":
            vendor_review_counts[t.vendor_id]["rejected"] += 1
    high_rejection_vendors = {}
    for vid, c in vendor_review_counts.items():
        reviewed = c["approved"] + c["rejected"]
        if reviewed >= 2:
            rate = c["rejected"] / reviewed
            if rate >= REJECTION_RATE_THRESHOLD:
                high_rejection_vendors[vid] = {
                    "rate": rate,
                    "approved": c["approved"],
                    "rejected": c["rejected"],
                }

    today = datetime.utcnow().date()

    # ---- Build per-WO alert lists ----------------------------------------
    wo_groups = []
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    source_counts = {"contractor": 0, "vendor": 0, "system": 0}
    next_alert_id = 1

    def push(group_alerts, *, severity, source, category, description,
             ticket_id=None, invoice_id=None, created_at=None,
             contractor=None):
        nonlocal next_alert_id
        group_alerts.append({
            "id": f"a{next_alert_id}",
            "severity": severity,
            "source": source,
            "category": category,
            "description": description,
            "ticket_id": ticket_id,
            "invoice_id": invoice_id,
            "contractor": contractor,
            "created_at": _iso(created_at),
        })
        next_alert_id += 1
        if severity in severity_counts:
            severity_counts[severity] += 1
        if source in source_counts:
            source_counts[source] += 1

    for wo in work_orders:
        alerts = []
        wo_tickets = tickets_by_wo.get(wo.id, [])
        wo_invoices = invoices_by_wo.get(wo.id, [])
        vendor = vendors_by_id.get(wo.assigned_vendor) if wo.assigned_vendor else None

        # 1. Contractor-app anomaly flags on this WO's tickets
        for t in wo_tickets:
            if not getattr(t, "anomaly_flag", False):
                continue
            reason = getattr(t, "anomaly_reason", None) or "Anomaly flag set on ticket"
            push(
                alerts,
                severity="HIGH",
                source="contractor",
                category="Contractor anomaly flag",
                description=reason,
                ticket_id=t.id,
                contractor=getattr(t, "assigned_contractor", None),
                created_at=getattr(t, "updated_at", None) or getattr(t, "created_at", None),
            )

        # 2. Vendor-side: rejected invoices on this WO
        for inv in wo_invoices:
            if _enum_value(inv.invoice_status) != "REJECTED":
                continue
            push(
                alerts,
                severity="MEDIUM",
                source="vendor",
                category="Rejected invoice",
                description=(
                    f"Invoice {inv.id[:8]} was rejected. "
                    "Confirm the vendor's submission and dispute path."
                ),
                invoice_id=inv.id,
                created_at=getattr(inv, "rejected_at", None) or getattr(inv, "updated_at", None),
            )

        # 3. System-derived signals
        # 3a. Invoice without approved tickets
        for inv in wo_invoices:
            if _enum_value(inv.invoice_status) == "DRAFT":
                continue
            if not wo_tickets:
                continue
            unapproved = [
                t for t in wo_tickets
                if _enum_value(getattr(t, "status", None)) != "APPROVED"
            ]
            if unapproved:
                push(
                    alerts,
                    severity="CRITICAL",
                    source="system",
                    category="Invoice without approved tickets",
                    description=(
                        f"Invoice {inv.id[:8]} ({_enum_value(inv.invoice_status)}) "
                        f"on a work order with {len(unapproved)} unapproved ticket(s)."
                    ),
                    invoice_id=inv.id,
                    created_at=getattr(inv, "created_at", None),
                )

        # 3b. All tickets approved but no invoice
        if wo_tickets and not wo_invoices:
            all_approved = all(
                _enum_value(getattr(t, "status", None)) == "APPROVED"
                for t in wo_tickets
            )
            if all_approved:
                push(
                    alerts,
                    severity="LOW",
                    source="system",
                    category="Missing invoice",
                    description=(
                        f"All {len(wo_tickets)} ticket(s) approved but no invoice "
                        "has been generated."
                    ),
                )

        # 3c. Expired MSA on vendor with this WO active
        if vendor and _enum_value(getattr(wo, "current_status", None)) not in ("CANCELLED", "CLOSED"):
            for m in msas_by_vendor.get(vendor.id, []):
                ed = getattr(m, "expiration_date", None)
                if not ed:
                    continue
                ed_d = ed.date() if hasattr(ed, "date") else ed
                if ed_d < today:
                    push(
                        alerts,
                        severity="HIGH",
                        source="system",
                        category="Expired MSA with active work",
                        description=(
                            f"Vendor MSA expired on {ed_d.isoformat()} but this work "
                            "order is still active."
                        ),
                    )
                    break

        # 3d. Vendor compliance issue with this WO active
        if vendor and _enum_value(getattr(wo, "current_status", None)) not in ("CANCELLED", "CLOSED"):
            cs = getattr(vendor, "compliance_status", None)
            cs_val = _enum_value(cs)
            cs_norm = (cs_val or "").upper()
            if cs_norm in ("EXPIRED", "INCOMPLETE"):
                push(
                    alerts,
                    severity="HIGH" if cs_norm == "EXPIRED" else "MEDIUM",
                    source="system",
                    category=f"Vendor compliance {cs_norm.lower()}",
                    description=(
                        f"Vendor compliance is {cs_norm.lower()} while this work "
                        "order is active."
                    ),
                )

        # 3e. Vendor high rejection rate (informational on every WO that vendor owns)
        if wo.assigned_vendor and wo.assigned_vendor in high_rejection_vendors:
            stats = high_rejection_vendors[wo.assigned_vendor]
            push(
                alerts,
                severity="HIGH" if stats["rate"] >= 0.5 else "MEDIUM",
                source="system",
                category="High vendor rejection rate",
                description=(
                    f"Vendor has rejected {stats['rejected']} of "
                    f"{stats['approved'] + stats['rejected']} reviewed tickets "
                    f"on this client ({(stats['rate'] * 100):.0f}%)."
                ),
            )

        if not alerts:
            continue

        # Sort alerts within the WO by severity then source
        sev_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        alerts.sort(key=lambda a: (sev_rank.get(a["severity"], 9), a["source"]))

        wo_groups.append({
            "work_order_id": wo.id,
            "work_order_code": getattr(wo, "work_order_code", None),
            "description": wo.description or "",
            "current_status": _enum_value(getattr(wo, "current_status", None)),
            "vendor_id": wo.assigned_vendor,
            "vendor_name": _vendor_label(vendor) or (wo.assigned_vendor[:8] if wo.assigned_vendor else None),
            "alerts": alerts,
            "alert_count": len(alerts),
            "max_severity": alerts[0]["severity"],
        })

    # Sort work orders by worst-severity then by alert count
    sev_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    wo_groups.sort(
        key=lambda g: (sev_rank.get(g["max_severity"], 9), -g["alert_count"]),
    )

    total_alerts = sum(severity_counts.values())
    flagged_wo = len(wo_groups)
    return (
        jsonify({
            "kpis": {
                "total_alerts": total_alerts,
                "flagged_work_orders": flagged_wo,
                "by_severity": severity_counts,
                "by_source": source_counts,
            },
            "work_order_groups": wo_groups,
        }),
        200,
    )
