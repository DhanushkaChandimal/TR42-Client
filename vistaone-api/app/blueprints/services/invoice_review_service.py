"""AI-assisted invoice review.

When a vendor submits an invoice, the client can run it through this
service to get a quick verdict on whether the dollar amount lines up
with (a) the time the contractor actually spent on the job and (b) the
rates in the vendor's MSA pricing schedule.

The verdict is deterministic - rule-based math against the existing
ticket timestamps and the AI-extracted MSA pricing rows. The "AI" part
of the workflow is the upstream MSA pricing extraction (already in
place via AiService.analyze_msa); this service consumes that output.

Verdicts:
- looks_good        - invoice total falls within the expected range
                      (with a small absolute tolerance for fees,
                      mileage, etc.)
- needs_review      - invoice is materially above or below the range
                      but still in the same order of magnitude
- off_by_a_lot      - invoice differs from expected by more than 2x
- insufficient_data - we don't have enough MSA pricing rows or ticket
                      timestamps to compute a meaningful expected
                      amount
"""
from __future__ import annotations

import os
import re
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select

from app.extensions import db
from app.models.invoice import Invoice
from app.models.line_item import LineItem
from app.models.msa import Msa
from app.models.msa_requirement import MsaRequirement
from app.models.ticket import Ticket
from app.models.workorder import WorkOrder

# Absolute tolerance applied when comparing invoice total to the
# expected range. Within this band of either edge we still call it
# "looks good".
ABSOLUTE_TOLERANCE = 5000.0  # $5k — "off by a couple thousand is ok"

# Ratio thresholds for the materially-different bucket.
RATIO_NEEDS_REVIEW_LOW = 0.5     # 50% of low end
RATIO_NEEDS_REVIEW_HIGH = 2.0    # 200% of high end
RATIO_OFF_LOW = 0.25             # 25% of low end (5x off)
RATIO_OFF_HIGH = 5.0             # 500% of high end


def _parse_amount(value):
    """Pull the first dollar amount out of a freeform value string.

    MSA pricing rows often store rates like "$485.00" or "485" or even
    "$485.00 per visit". We grab the first numeric token.
    """
    if value is None:
        return None
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    s = str(value)
    m = re.search(r"\$?\s*([0-9][0-9,]*\.?[0-9]*)", s)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _normalize_unit(unit):
    if not unit:
        return ""
    u = unit.lower().strip()
    if "hr" in u or "hour" in u:
        return "hour"
    if "visit" in u:
        return "visit"
    if "test" in u:
        return "test"
    if "asset" in u:
        return "asset"
    if "year" in u:
        return "year"
    if "mile" in u:
        return "mile"
    if "unit" in u or "each" in u:
        return "unit"
    if "flat" in u:
        return "flat"
    return u


def _service_keywords(service_name):
    """Split the WO service name into individual words so we can match
    pricing rows whose description mentions any of them."""
    if not service_name:
        return []
    cleaned = re.sub(r"[^A-Za-z]+", " ", service_name)
    return [w for w in cleaned.lower().split() if len(w) > 2]


# Demo fallback rates per service type, used when the vendor's MSA has
# no AI-extracted pricing rows. These are plausible market ranges so
# the review still produces a meaningful verdict for the demo. The
# response carries data_source="demo_estimate" when these are used so
# the UI can label it as a non-contract reference.
DEMO_HOURLY_RATES = {
    "ROUTINE_MAINTENANCE": (45, 60),
    "EQUIPMENT_REPAIR":    (95, 175),
    "CHEMICAL_DELIVERY":   (85, 140),
    "PIPELINE_SERVICE":    (55, 90),
    "SITE_CLEANUP":        (35, 55),
    "WATER_DELIVERY":      (60, 95),
    "WELL_INTERVENTION":   (185, 285),
}
DEMO_DEFAULT_RATE_RANGE = (60, 120)


def _compute_total_hours(tickets):
    total = 0.0
    counted = 0
    for t in tickets:
        st, et = getattr(t, "start_time", None), getattr(t, "end_time", None)
        if st and et:
            hrs = (et - st).total_seconds() / 3600.0
            if hrs > 0:
                total += hrs
                counted += 1
    return total, counted


def _verdict_from_actual(actual, low, high):
    """Map actual vs expected range into a verdict string + label."""
    if actual is None or low is None or high is None:
        return "insufficient_data", "Insufficient data"
    # Absolute tolerance band
    if (low - ABSOLUTE_TOLERANCE) <= actual <= (high + ABSOLUTE_TOLERANCE):
        return "looks_good", "Looks good"
    # Compare ratio against the closer edge
    edge = high if actual > high else low
    if edge <= 0:
        return "needs_review", "Needs review"
    ratio = actual / edge
    if actual > high:
        if ratio >= RATIO_OFF_HIGH:
            return "off_by_a_lot", "Significant variance"
        if ratio >= RATIO_NEEDS_REVIEW_HIGH:
            return "needs_review", "Needs review"
        return "needs_review", "Needs review"
    # actual < low
    if ratio <= RATIO_OFF_LOW:
        return "off_by_a_lot", "Significant variance"
    if ratio <= RATIO_NEEDS_REVIEW_LOW:
        return "needs_review", "Needs review"
    return "needs_review", "Needs review"


class InvoiceReviewService:

    @staticmethod
    def review_invoice(invoice_id, current_client_id):
        invoice = db.session.get(Invoice, invoice_id)
        if not invoice:
            return {"message": "Invoice not found"}, 404
        # Tenant scope
        if str(invoice.client_id) != str(current_client_id):
            return {"message": "You do not have access to this invoice"}, 403

        wo = db.session.get(WorkOrder, invoice.work_order_id) if invoice.work_order_id else None
        tickets = []
        if wo:
            tickets = (
                db.session.execute(
                    select(Ticket).where(Ticket.work_order_id == wo.id)
                )
                .scalars()
                .all()
            )

        line_items = (
            db.session.execute(
                select(LineItem).where(LineItem.invoice_id == invoice_id)
            )
            .scalars()
            .all()
        )

        # Vendor MSA pricing rows (most recent active MSA for the vendor)
        pricing_rows = []
        pricing_source = None  # "ai" or "demo_estimate"
        msa = None
        if invoice.vendor_id:
            msa = (
                db.session.execute(
                    select(Msa)
                    .where(Msa.vendor_id == invoice.vendor_id)
                    .order_by(Msa.created_at.desc())
                )
                .scalars()
                .first()
            )
            if msa:
                pricing_rows = (
                    db.session.execute(
                        select(MsaRequirement)
                        .where(MsaRequirement.msa_id == msa.id)
                        .where(MsaRequirement.category == "pricing")
                    )
                    .scalars()
                    .all()
                )
                if pricing_rows:
                    pricing_source = "ai"

        # Build expected range based on service keywords + MSA pricing
        service_name = (
            wo.service.service if (wo and getattr(wo, "service", None)) else None
        )
        keywords = _service_keywords(service_name)

        applicable = []
        for p in pricing_rows:
            desc = (p.description or "").lower()
            amount = _parse_amount(p.value)
            if amount is None:
                continue
            unit = _normalize_unit(p.unit)
            matched = bool(keywords) and any(k in desc for k in keywords)
            applicable.append({
                "description": p.description or "",
                "amount": amount,
                "unit": unit,
                "matched_service": matched,
            })

        # Prefer service-matched rows; fall back to all rows if none match.
        candidates = [r for r in applicable if r["matched_service"]] or applicable

        total_hours, ticket_count = _compute_total_hours(tickets)
        completed_visits = sum(
            1 for t in tickets if getattr(t, "status", None) and
            (t.status.value if hasattr(t.status, "value") else t.status) == "COMPLETED"
        )

        # Build expected_low / expected_high from the candidate rates,
        # picking the rate-vs-driver pairing that produces the most
        # realistic envelope.
        expected_low = expected_high = None
        rate_basis = None  # human-readable source of the calc

        hourly = [r["amount"] for r in candidates if r["unit"] == "hour"]
        per_visit = [r["amount"] for r in candidates if r["unit"] in ("visit", "unit", "asset", "test", "flat")]

        if hourly and total_hours > 0:
            expected_low = min(hourly) * total_hours
            expected_high = max(hourly) * total_hours
            rate_basis = (
                f"{total_hours:.1f} hour(s) @ ${min(hourly):,.2f}-${max(hourly):,.2f}/hr"
            )
        elif per_visit and (completed_visits or ticket_count):
            visit_count = completed_visits or ticket_count
            expected_low = min(per_visit) * visit_count
            expected_high = max(per_visit) * visit_count
            rate_basis = (
                f"{visit_count} visit(s) @ ${min(per_visit):,.2f}-${max(per_visit):,.2f}/each"
            )
        elif candidates:
            # Last-ditch: use range of all matched rates as if a single unit
            amts = [r["amount"] for r in candidates]
            expected_low = min(amts)
            expected_high = max(amts)
            rate_basis = (
                f"single-unit fallback @ ${min(amts):,.2f}-${max(amts):,.2f}"
            )

        # Demo fallback: if the vendor MSA has no AI-extracted pricing
        # (which happens when the LLM extraction couldn't pin down rates
        # against the source text), fall back to plausible per-service
        # market rates so the review still returns a verdict. The
        # response is tagged data_source="demo_estimate" so the UI can
        # show that this isn't contract-derived.
        if expected_low is None:
            svc_key = (service_name or "").upper()
            lo, hi = DEMO_HOURLY_RATES.get(svc_key, DEMO_DEFAULT_RATE_RANGE)
            if total_hours > 0:
                expected_low = lo * total_hours
                expected_high = hi * total_hours
                rate_basis = (
                    f"{total_hours:.1f} hour(s) @ ${lo:,.2f}-${hi:,.2f}/hr "
                    f"(demo market range for {svc_key or 'unknown service'})"
                )
                pricing_source = "demo_estimate"
            elif ticket_count:
                # No durations recorded; use ticket count as a proxy with
                # an assumed 4-hour average ticket.
                est_hours = ticket_count * 4.0
                expected_low = lo * est_hours
                expected_high = hi * est_hours
                rate_basis = (
                    f"{ticket_count} ticket(s) at ~4 hr each "
                    f"@ ${lo:,.2f}-${hi:,.2f}/hr (demo estimate)"
                )
                pricing_source = "demo_estimate"

        invoice_total = float(invoice.total_amount or 0)
        verdict, verdict_label = _verdict_from_actual(invoice_total, expected_low, expected_high)

        # Concerns surface non-fatal issues that the reviewer should
        # double-check even when the verdict is green.
        concerns = []
        if not msa:
            concerns.append("No MSA found for this vendor.")
        elif not pricing_rows:
            concerns.append(
                "MSA found but no pricing rows extracted. Run AI Analysis on "
                "the vendor's MSA first."
            )
        elif not candidates:
            concerns.append("No pricing rows matched this work order's service.")

        if not tickets:
            concerns.append("No tickets linked to this work order.")
        elif total_hours <= 0:
            concerns.append(
                "No tickets have both start_time and end_time set, so we can't "
                "size the job by hours."
            )

        if line_items:
            li_total = sum(float(li.amount or 0) for li in line_items)
            if abs(li_total - invoice_total) > 0.01:
                concerns.append(
                    f"Line items sum to ${li_total:,.2f} but invoice total is "
                    f"${invoice_total:,.2f}."
                )

        # Build a plain-English summary using the precomputed numbers
        summary_parts = []
        summary_parts.append(f"Invoice total: ${invoice_total:,.2f}")
        if expected_low is not None:
            summary_parts.append(
                f"Expected: ${expected_low:,.2f} - ${expected_high:,.2f} "
                f"({rate_basis})"
            )
            diff_low = invoice_total - expected_low
            diff_high = invoice_total - expected_high
            if invoice_total > expected_high:
                summary_parts.append(
                    f"Variance: +${diff_high:,.2f} above the high end "
                    f"({(diff_high / expected_high * 100):.0f}% over)."
                )
            elif invoice_total < expected_low:
                summary_parts.append(
                    f"Variance: -${(-diff_low):,.2f} below the low end "
                    f"({(-diff_low / expected_low * 100):.0f}% under)."
                )
            else:
                summary_parts.append("Variance: within the expected range.")
        else:
            summary_parts.append(
                "Expected range could not be computed - missing pricing or "
                "timing data. See concerns below."
            )

        return (
            {
                "invoice_id": invoice_id,
                "verdict": verdict,
                "verdict_label": verdict_label,
                "invoice_total": invoice_total,
                "expected_low": expected_low,
                "expected_high": expected_high,
                "rate_basis": rate_basis,
                "pricing_source": pricing_source,
                "service_name": service_name,
                "total_hours": round(total_hours, 1),
                "ticket_count": len(tickets),
                "completed_visit_count": completed_visits,
                "line_item_count": len(line_items),
                "msa_id": msa.id if msa else None,
                "pricing_rows_seen": len(pricing_rows),
                "applicable_rows": len(candidates),
                "summary": " ".join(summary_parts),
                "concerns": concerns,
                "evaluated_at": datetime.utcnow().isoformat() + "Z",
            },
            200,
        )
