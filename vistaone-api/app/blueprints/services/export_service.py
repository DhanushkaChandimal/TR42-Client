"""Excel export service.

Builds polished .xlsx workbooks for two pages:
  - Analytics: KPIs, vendor performance, invoice pipeline, outstanding,
    cost by service, WO status, MSA expiries
  - Invoices: every invoice with vendor + WO context, line items on a
    second sheet, summary on a third

Shared formatting helpers up top so both workbooks look consistent:
bold colored headers, frozen first row, auto-filter, currency / date
formatting, sized columns.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from io import BytesIO
from statistics import quantiles, median

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, DataBarRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.page import PageMargins
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.client import Client
from app.models.invoice import Invoice
from app.models.line_item import LineItem
from app.models.msa import Msa
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.models.workorder import WorkOrder


# ---------------------------------------------------------------------------
# Styling helpers
# ---------------------------------------------------------------------------

HEADER_FILL = PatternFill("solid", fgColor="1F3A8A")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
SUBHEADER_FILL = PatternFill("solid", fgColor="EEF2FF")
SUBHEADER_FONT = Font(bold=True, color="1F3A8A", size=11)
TITLE_FONT = Font(bold=True, size=16, color="1F2937")
META_FONT = Font(italic=True, color="6B7280", size=10)
THIN_BORDER = Border(
    left=Side(style="thin", color="E5E7EB"),
    right=Side(style="thin", color="E5E7EB"),
    top=Side(style="thin", color="E5E7EB"),
    bottom=Side(style="thin", color="E5E7EB"),
)
SEVERITY_FILLS = {
    "REJECTED": PatternFill("solid", fgColor="FEE2E2"),
    "PAID": PatternFill("solid", fgColor="DCFCE7"),
    "APPROVED": PatternFill("solid", fgColor="DCFCE7"),
    "PENDING": PatternFill("solid", fgColor="FEF3C7"),
    "DRAFT": PatternFill("solid", fgColor="F3F4F6"),
    "SUBMITTED": PatternFill("solid", fgColor="DBEAFE"),
}


def _write_title(ws, title, subtitle=None):
    ws["A1"] = title
    ws["A1"].font = TITLE_FONT
    if subtitle:
        ws["A2"] = subtitle
        ws["A2"].font = META_FONT
    ws["A3"] = (
        f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    ws["A3"].font = META_FONT


def _write_header(ws, row, columns):
    for col_idx, (label, _width, _fmt) in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=col_idx, value=label)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="left", vertical="center")
        cell.border = THIN_BORDER


def _apply_widths(ws, columns, start_col=1):
    for col_idx, (_label, width, _fmt) in enumerate(columns, start=start_col):
        ws.column_dimensions[get_column_letter(col_idx)].width = width


def _write_row(ws, row_idx, columns, values, status_col=None):
    fill = None
    if status_col is not None:
        status_value = values[status_col]
        if status_value in SEVERITY_FILLS:
            fill = SEVERITY_FILLS[status_value]
    for col_idx, ((_, _, fmt), value) in enumerate(zip(columns, values), start=1):
        cell = ws.cell(row=row_idx, column=col_idx, value=value)
        if fmt:
            cell.number_format = fmt
        cell.border = THIN_BORDER
        if fill:
            cell.fill = fill


def _finalize_data_sheet(ws, header_row, columns, data_row_count):
    if data_row_count == 0:
        return
    last_col = get_column_letter(len(columns))
    last_row = header_row + data_row_count
    ws.auto_filter.ref = f"A{header_row}:{last_col}{last_row}"
    ws.freeze_panes = ws[f"A{header_row + 1}"]


def _naive(value):
    """Strip tzinfo from datetime/date so openpyxl can serialize it.

    Postgres timestamptz columns come back as aware datetimes; Excel cells
    only accept naive datetimes.
    """
    if value is None:
        return None
    if isinstance(value, datetime) and value.tzinfo is not None:
        return value.replace(tzinfo=None)
    return value


def _to_workbook_bytes(wb):
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Analytics workbook
# ---------------------------------------------------------------------------


def build_analytics_workbook(start=None, end=None):
    wb = Workbook()
    wb.remove(wb.active)

    tickets = [
        t for t in db.session.execute(select(Ticket)).scalars().all()
        if not (start or end) or _in_range(t.created_at, start, end)
    ]
    vendors = db.session.execute(select(Vendor)).scalars().all()
    invoices = [
        i for i in db.session.execute(select(Invoice)).scalars().all()
        if not (start or end) or _in_range(i.invoice_date, start, end)
    ]
    work_orders = [
        w for w in db.session.execute(select(WorkOrder)).scalars().all()
        if not (start or end) or _in_range(w.created_at, start, end)
    ]
    msas = db.session.execute(select(Msa)).scalars().all()

    vendors_by_id = {v.id: v for v in vendors}
    workorders_by_id = {w.id: w for w in work_orders}

    _write_summary_sheet(wb, tickets, vendors, invoices, work_orders, msas, period=_period_label(start, end))
    _write_vendor_performance_sheet(wb, tickets, vendors_by_id)
    _write_invoice_pipeline_sheet(wb, invoices)
    _write_outstanding_sheet(wb, invoices, vendors_by_id)
    _write_cost_by_service_sheet(wb, invoices, workorders_by_id)
    _write_wo_status_sheet(wb, work_orders)
    _write_msa_expiry_sheet(wb, msas, vendors_by_id, work_orders)

    return _to_workbook_bytes(wb)


def _write_summary_sheet(ws_wb, tickets, vendors, invoices, work_orders, msas, period=None):
    ws = ws_wb.create_sheet("Overview")
    subtitle = "Top-line KPIs across tickets, vendors, invoices, work orders."
    if period:
        subtitle = f"{subtitle}  ·  Period: {period}"
    _write_title(
        ws,
        "Analytics Overview",
        subtitle,
    )

    approved = sum(1 for t in tickets if _enum_value(t.status) == "APPROVED")
    rejected = sum(1 for t in tickets if _enum_value(t.status) == "REJECTED")
    reviewed = approved + rejected
    approval_rate = (approved / reviewed) if reviewed else 0
    active_wo = sum(
        1
        for w in work_orders
        if _enum_value(getattr(w, "current_status", None)) not in ("CANCELLED", "CLOSED")
    )

    rows = [
        ("Total tickets", len(tickets), None),
        ("Approved tickets", approved, None),
        ("Rejected tickets", rejected, None),
        ("Approval rate", approval_rate, "0.0%"),
        ("Vendors", len(vendors), None),
        ("Active work orders", active_wo, None),
        ("Total invoices", len(invoices), None),
        (
            "Total invoiced ($)",
            sum(float(i.total_amount or 0) for i in invoices),
            "$#,##0.00",
        ),
        ("MSAs on file", len(msas), None),
    ]

    header_row = 5
    cols = [("Metric", 32, None), ("Value", 22, None)]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)
    for i, (label, value, fmt) in enumerate(rows, start=header_row + 1):
        ws.cell(row=i, column=1, value=label).border = THIN_BORDER
        cell = ws.cell(row=i, column=2, value=value)
        cell.border = THIN_BORDER
        if fmt:
            cell.number_format = fmt
    _finalize_data_sheet(ws, header_row, cols, len(rows))


def _write_vendor_performance_sheet(ws_wb, tickets, vendors_by_id):
    ws = ws_wb.create_sheet("Vendor Performance")
    _write_title(ws, "Vendor Performance", "Ticket counts, approval rates, and average approval time per vendor.")

    by_vendor = defaultdict(list)
    for t in tickets:
        if t.vendor_id:
            by_vendor[t.vendor_id].append(t)

    rows = []
    for vendor_id, ts in by_vendor.items():
        v = vendors_by_id.get(vendor_id)
        approved = [t for t in ts if _enum_value(t.status) == "APPROVED"]
        rejected = [t for t in ts if _enum_value(t.status) == "REJECTED"]
        pending = [t for t in ts if _enum_value(t.status) == "PENDING_APPROVAL"]
        reviewed = len(approved) + len(rejected)
        rejection_rate = len(rejected) / reviewed if reviewed else 0

        approval_hours_total = 0.0
        approval_count = 0
        for t in approved:
            if t.created_at and t.approved_at:
                delta = (t.approved_at - t.created_at).total_seconds() / 3600
                approval_hours_total += delta
                approval_count += 1
        avg_hours = approval_hours_total / approval_count if approval_count else None

        rows.append(
            [
                v.company_name if v and v.company_name else (v.name if v else vendor_id[:8]),
                len(ts),
                len(approved),
                len(rejected),
                len(pending),
                rejection_rate,
                avg_hours,
            ]
        )

    rows.sort(key=lambda r: (r[5], r[3]), reverse=True)

    header_row = 5
    cols = [
        ("Vendor", 30, None),
        ("Total tickets", 14, "#,##0"),
        ("Approved", 12, "#,##0"),
        ("Rejected", 12, "#,##0"),
        ("Pending", 12, "#,##0"),
        ("Rejection rate", 16, "0.0%"),
        ("Avg approval (hrs)", 18, "0.0"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)
    for i, row in enumerate(rows, start=header_row + 1):
        _write_row(ws, i, cols, row)
    _finalize_data_sheet(ws, header_row, cols, len(rows))


def _write_invoice_pipeline_sheet(ws_wb, invoices):
    ws = ws_wb.create_sheet("Invoice Pipeline")
    _write_title(ws, "Invoice Pipeline", "Invoice counts and dollar totals by status.")

    buckets = defaultdict(lambda: {"count": 0, "amount": 0.0})
    for inv in invoices:
        status = _enum_value(inv.invoice_status) or "UNKNOWN"
        buckets[status]["count"] += 1
        buckets[status]["amount"] += float(inv.total_amount or 0)

    header_row = 5
    cols = [
        ("Status", 18, None),
        ("Count", 12, "#,##0"),
        ("Total ($)", 18, "$#,##0.00"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)
    rows = sorted(buckets.items(), key=lambda kv: kv[1]["amount"], reverse=True)
    for i, (status, slot) in enumerate(rows, start=header_row + 1):
        _write_row(ws, i, cols, [status, slot["count"], slot["amount"]], status_col=0)
    _finalize_data_sheet(ws, header_row, cols, len(rows))


def _write_outstanding_sheet(ws_wb, invoices, vendors_by_id):
    ws = ws_wb.create_sheet("Outstanding by Vendor")
    _write_title(ws, "Outstanding Invoices by Vendor", "Anything not PAID and not REJECTED counts as outstanding.")

    by_vendor = defaultdict(lambda: {"count": 0, "amount": 0.0})
    for inv in invoices:
        status = _enum_value(inv.invoice_status)
        if status in ("PAID", "REJECTED"):
            continue
        vid = inv.vendor_id or "unknown"
        by_vendor[vid]["count"] += 1
        by_vendor[vid]["amount"] += float(inv.total_amount or 0)

    header_row = 5
    cols = [
        ("Vendor", 30, None),
        ("Open invoices", 14, "#,##0"),
        ("Outstanding ($)", 20, "$#,##0.00"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)
    rows = sorted(by_vendor.items(), key=lambda kv: kv[1]["amount"], reverse=True)
    for i, (vid, slot) in enumerate(rows, start=header_row + 1):
        v = vendors_by_id.get(vid)
        name = (
            v.company_name if v and v.company_name else (v.name if v else vid[:8])
        )
        _write_row(ws, i, cols, [name, slot["count"], slot["amount"]])
    _finalize_data_sheet(ws, header_row, cols, len(rows))


def _write_cost_by_service_sheet(ws_wb, invoices, workorders_by_id):
    ws = ws_wb.create_sheet("Cost by Service")
    _write_title(ws, "Cost by Service Type", "Invoice totals grouped by the service type on the underlying work order.")

    by_service = defaultdict(
        lambda: {
            "invoice_count": 0,
            "total": 0.0,
            "approved": 0.0,
            "pending": 0.0,
            "rejected": 0.0,
            "paid": 0.0,
        }
    )
    for inv in invoices:
        wo = workorders_by_id.get(inv.work_order_id)
        service_name = "Unknown"
        if wo:
            st = wo.service_type
            if hasattr(st, "service"):
                service_name = st.service
            elif st:
                service_name = str(st)
        amount = float(inv.total_amount or 0)
        slot = by_service[service_name]
        slot["invoice_count"] += 1
        slot["total"] += amount
        status = _enum_value(inv.invoice_status)
        if status == "APPROVED":
            slot["approved"] += amount
        elif status == "PENDING":
            slot["pending"] += amount
        elif status == "REJECTED":
            slot["rejected"] += amount
        elif status == "PAID":
            slot["paid"] += amount

    header_row = 5
    cols = [
        ("Service", 26, None),
        ("Invoice count", 14, "#,##0"),
        ("Total ($)", 18, "$#,##0.00"),
        ("Approved ($)", 18, "$#,##0.00"),
        ("Pending ($)", 18, "$#,##0.00"),
        ("Rejected ($)", 18, "$#,##0.00"),
        ("Paid ($)", 18, "$#,##0.00"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)
    rows = sorted(by_service.items(), key=lambda kv: kv[1]["total"], reverse=True)
    for i, (service, slot) in enumerate(rows, start=header_row + 1):
        _write_row(
            ws,
            i,
            cols,
            [
                service,
                slot["invoice_count"],
                slot["total"],
                slot["approved"],
                slot["pending"],
                slot["rejected"],
                slot["paid"],
            ],
        )
    _finalize_data_sheet(ws, header_row, cols, len(rows))


def _write_wo_status_sheet(ws_wb, work_orders):
    ws = ws_wb.create_sheet("WO by Status")
    _write_title(ws, "Work Orders by Status", "Count of work orders in each lifecycle status.")

    by_status = defaultdict(int)
    for w in work_orders:
        by_status[_enum_value(getattr(w, "current_status", None)) or "UNKNOWN"] += 1

    header_row = 5
    cols = [("Status", 18, None), ("Count", 12, "#,##0")]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)
    rows = sorted(by_status.items(), key=lambda kv: kv[1], reverse=True)
    for i, (status, count) in enumerate(rows, start=header_row + 1):
        _write_row(ws, i, cols, [status, count])
    _finalize_data_sheet(ws, header_row, cols, len(rows))


def _write_msa_expiry_sheet(ws_wb, msas, vendors_by_id, work_orders):
    ws = ws_wb.create_sheet("MSAs Expiring (90d)")
    _write_title(ws, "MSAs Expiring in the Next 90 Days", "Includes vendor name and current active WO count for context.")

    today = datetime.utcnow().date()
    cutoff = today + timedelta(days=90)
    active_wo_by_vendor = defaultdict(int)
    for w in work_orders:
        if _enum_value(getattr(w, "current_status", None)) in ("CANCELLED", "CLOSED"):
            continue
        if w.assigned_vendor:
            active_wo_by_vendor[w.assigned_vendor] += 1

    rows = []
    for m in msas:
        if not m.expiration_date:
            continue
        if not (today <= m.expiration_date <= cutoff):
            continue
        v = vendors_by_id.get(m.vendor_id)
        rows.append(
            [
                v.company_name if v and v.company_name else (v.name if v else "Unknown"),
                m.version or "",
                m.expiration_date,
                (m.expiration_date - today).days,
                m.status or "",
                active_wo_by_vendor.get(m.vendor_id, 0),
            ]
        )
    rows.sort(key=lambda r: r[3])

    header_row = 5
    cols = [
        ("Vendor", 30, None),
        ("Version", 10, None),
        ("Expires", 14, "yyyy-mm-dd"),
        ("Days left", 12, "#,##0"),
        ("Status", 14, None),
        ("Active WOs", 12, "#,##0"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)
    for i, row in enumerate(rows, start=header_row + 1):
        _write_row(ws, i, cols, row)
    _finalize_data_sheet(ws, header_row, cols, len(rows))


# ---------------------------------------------------------------------------
# Invoices workbook
# ---------------------------------------------------------------------------


def build_invoices_workbook(start=None, end=None):
    wb = Workbook()
    wb.remove(wb.active)

    invoices = (
        db.session.execute(
            select(Invoice).options(joinedload(Invoice.line_items))
        )
        .unique()
        .scalars()
        .all()
    )
    if start or end:
        invoices = [
            i for i in invoices if _in_range(i.invoice_date, start, end)
        ]
    vendors = {v.id: v for v in db.session.execute(select(Vendor)).scalars().all()}
    work_orders = {
        w.id: w for w in db.session.execute(select(WorkOrder)).scalars().all()
    }

    _write_invoice_summary_sheet(wb, invoices, vendors, period=_period_label(start, end))
    _write_invoices_by_vendor_sheet(wb, invoices, vendors, work_orders)
    _write_invoices_flat_sheet(wb, invoices, vendors, work_orders)
    _write_line_items_sheet(wb, invoices, vendors)

    return _to_workbook_bytes(wb)


def _vendor_name(v):
    if not v:
        return "Unknown vendor"
    return v.company_name or v.name or "Unknown vendor"


def _invoice_dates_range(invoices):
    dates = [_naive(inv.invoice_date) for inv in invoices if inv.invoice_date]
    if not dates:
        return None, None
    return min(dates), max(dates)


def _write_invoice_summary_sheet(ws_wb, invoices, vendors_by_id, period=None):
    ws = ws_wb.create_sheet("Summary")

    if period and period != "All time":
        subtitle = f"Period covered: {period}"
    else:
        period_start, period_end = _invoice_dates_range(invoices)
        if period_start and period_end:
            subtitle = (
                f"Period covered: {period_start.strftime('%Y-%m-%d')} "
                f"to {period_end.strftime('%Y-%m-%d')}"
            )
        else:
            subtitle = "Period covered: (no invoices)"

    _write_title(
        ws,
        "Invoice Summary Report",
        subtitle,
    )

    # KPI block
    by_status = defaultdict(lambda: {"count": 0, "amount": 0.0})
    by_vendor_outstanding = defaultdict(lambda: {"count": 0, "amount": 0.0})
    grand_total = 0.0
    paid_total = 0.0
    outstanding_total = 0.0
    for inv in invoices:
        status = _enum_value(inv.invoice_status) or "UNKNOWN"
        amount = float(inv.total_amount or 0)
        grand_total += amount
        by_status[status]["count"] += 1
        by_status[status]["amount"] += amount
        if status == "PAID":
            paid_total += amount
        elif status not in ("REJECTED",):
            outstanding_total += amount
            vid = inv.vendor_id or "unknown"
            by_vendor_outstanding[vid]["count"] += 1
            by_vendor_outstanding[vid]["amount"] += amount

    kpi_row = 5
    ws.cell(row=kpi_row, column=1, value="KEY METRICS").font = SUBHEADER_FONT
    ws.cell(row=kpi_row, column=1).fill = SUBHEADER_FILL
    kpis = [
        ("Total invoices", len(invoices), "#,##0"),
        ("Total invoiced", grand_total, "$#,##0.00"),
        ("Paid", paid_total, "$#,##0.00"),
        ("Outstanding (not paid, not rejected)", outstanding_total, "$#,##0.00"),
    ]
    for i, (label, value, fmt) in enumerate(kpis, start=kpi_row + 1):
        ws.cell(row=i, column=1, value=label).border = THIN_BORDER
        cell = ws.cell(row=i, column=2, value=value)
        cell.border = THIN_BORDER
        if fmt:
            cell.number_format = fmt
    ws.column_dimensions["A"].width = 38
    ws.column_dimensions["B"].width = 22

    # Status breakdown table
    status_header_row = kpi_row + len(kpis) + 3
    ws.cell(row=status_header_row - 1, column=1, value="BREAKDOWN BY STATUS").font = SUBHEADER_FONT
    ws.cell(row=status_header_row - 1, column=1).fill = SUBHEADER_FILL
    cols = [
        ("Status", 18, None),
        ("Count", 12, "#,##0"),
        ("Total", 18, "$#,##0.00"),
    ]
    _write_header(ws, status_header_row, cols)
    status_rows = sorted(
        by_status.items(), key=lambda kv: kv[1]["amount"], reverse=True
    )
    for i, (status, slot) in enumerate(status_rows, start=status_header_row + 1):
        _write_row(
            ws,
            i,
            cols,
            [status, slot["count"], slot["amount"]],
            status_col=0,
        )
    bottom = status_header_row + len(status_rows)
    grand_row = bottom + 1
    ws.cell(row=grand_row, column=1, value="GRAND TOTAL").font = SUBHEADER_FONT
    ws.cell(row=grand_row, column=1).fill = SUBHEADER_FILL
    ws.cell(row=grand_row, column=1).border = THIN_BORDER
    cnt_cell = ws.cell(
        row=grand_row,
        column=2,
        value=sum(s["count"] for s in by_status.values()),
    )
    cnt_cell.number_format = "#,##0"
    cnt_cell.font = SUBHEADER_FONT
    cnt_cell.border = THIN_BORDER
    total_cell = ws.cell(row=grand_row, column=3, value=grand_total)
    total_cell.number_format = "$#,##0.00"
    total_cell.font = SUBHEADER_FONT
    total_cell.border = THIN_BORDER

    # Top outstanding vendors
    sub_row = grand_row + 3
    ws.cell(row=sub_row - 1, column=1, value="OUTSTANDING BY VENDOR (not paid, not rejected)").font = SUBHEADER_FONT
    ws.cell(row=sub_row - 1, column=1).fill = SUBHEADER_FILL
    sub_cols = [
        ("Vendor", 32, None),
        ("Open invoices", 14, "#,##0"),
        ("Outstanding", 20, "$#,##0.00"),
    ]
    _apply_widths(ws, sub_cols)
    _write_header(ws, sub_row, sub_cols)
    sub_rows = sorted(
        by_vendor_outstanding.items(),
        key=lambda kv: kv[1]["amount"],
        reverse=True,
    )
    for i, (vid, slot) in enumerate(sub_rows, start=sub_row + 1):
        v = vendors_by_id.get(vid)
        _write_row(ws, i, sub_cols, [_vendor_name(v), slot["count"], slot["amount"]])


def _write_invoices_by_vendor_sheet(
    ws_wb, invoices, vendors_by_id, workorders_by_id
):
    """Per-vendor groupings with subtotals -- the client-friendly view."""
    ws = ws_wb.create_sheet("By Vendor")
    _write_title(
        ws,
        "Invoices by Vendor",
        "Grouped per vendor with a subtotal beneath each block. Rows are color-coded by status.",
    )

    cols = [
        ("Invoice #", 12, None),
        ("WO #", 10, "#,##0"),
        ("Status", 14, None),
        ("Invoice Date", 14, "yyyy-mm-dd"),
        ("Due Date", 14, "yyyy-mm-dd"),
        ("Period Start", 14, "yyyy-mm-dd"),
        ("Period End", 14, "yyyy-mm-dd"),
        ("Approved", 14, "yyyy-mm-dd"),
        ("Paid", 14, "yyyy-mm-dd"),
        ("Amount", 16, "$#,##0.00"),
    ]
    _apply_widths(ws, cols)

    # Group by vendor
    by_vendor = defaultdict(list)
    for inv in invoices:
        by_vendor[inv.vendor_id or "unknown"].append(inv)

    # Sort vendors by total (desc) so largest billers are first
    vendor_totals = {
        vid: sum(float(i.total_amount or 0) for i in invs)
        for vid, invs in by_vendor.items()
    }
    sorted_vendors = sorted(
        by_vendor.keys(),
        key=lambda vid: vendor_totals[vid],
        reverse=True,
    )

    row = 5
    for vid in sorted_vendors:
        v = vendors_by_id.get(vid)
        invs = sorted(
            by_vendor[vid],
            key=lambda inv: inv.invoice_date or datetime.min,
            reverse=True,
        )

        # Vendor banner
        banner = ws.cell(row=row, column=1, value=_vendor_name(v))
        banner.font = Font(bold=True, color="FFFFFF", size=12)
        banner.fill = HEADER_FILL
        ws.merge_cells(
            start_row=row, start_column=1, end_row=row, end_column=len(cols)
        )
        row += 1

        # Vendor meta line (code + contact)
        if v:
            meta_parts = []
            if v.vendor_code:
                meta_parts.append(f"Vendor code: {v.vendor_code}")
            if v.primary_contact_name:
                meta_parts.append(f"Contact: {v.primary_contact_name}")
            if v.company_email:
                meta_parts.append(v.company_email)
            if v.company_phone:
                meta_parts.append(v.company_phone)
            if meta_parts:
                meta_cell = ws.cell(row=row, column=1, value=" · ".join(meta_parts))
                meta_cell.font = META_FONT
                ws.merge_cells(
                    start_row=row, start_column=1, end_row=row, end_column=len(cols)
                )
                row += 1

        # Column headers for this block
        _write_header(ws, row, cols)
        row += 1

        vendor_total = 0.0
        for inv in invs:
            wo = workorders_by_id.get(inv.work_order_id)
            wo_code = getattr(wo, "work_order_code", None) if wo else None
            status = _enum_value(inv.invoice_status)
            amount = float(inv.total_amount or 0)
            vendor_total += amount
            _write_row(
                ws,
                row,
                cols,
                [
                    inv.id[:8],
                    wo_code,
                    status,
                    _naive(inv.invoice_date),
                    _naive(inv.due_date),
                    _naive(inv.period_start),
                    _naive(inv.period_end),
                    _naive(inv.approved_at),
                    _naive(inv.paid_at),
                    amount,
                ],
                status_col=2,
            )
            row += 1

        # Subtotal row
        sub = ws.cell(row=row, column=1, value="Vendor subtotal")
        sub.font = SUBHEADER_FONT
        sub.fill = SUBHEADER_FILL
        sub.border = THIN_BORDER
        for c in range(2, len(cols)):
            ws.cell(row=row, column=c, value=None).fill = SUBHEADER_FILL
            ws.cell(row=row, column=c).border = THIN_BORDER
        amount_cell = ws.cell(row=row, column=len(cols), value=vendor_total)
        amount_cell.number_format = "$#,##0.00"
        amount_cell.font = SUBHEADER_FONT
        amount_cell.fill = SUBHEADER_FILL
        amount_cell.border = THIN_BORDER
        row += 2  # blank row between vendors

    ws.freeze_panes = ws["A5"]


def _write_invoices_flat_sheet(ws_wb, invoices, vendors_by_id, workorders_by_id):
    """Flat sortable/filterable sheet -- for analysts who want one big table."""
    ws = ws_wb.create_sheet("All Invoices (flat)")
    _write_title(
        ws,
        "All Invoices",
        "Flat list of every invoice. Use the auto-filter on the header row to slice.",
    )

    header_row = 5
    cols = [
        ("Vendor", 30, None),
        ("Invoice #", 12, None),
        ("WO #", 10, "#,##0"),
        ("Status", 14, None),
        ("Invoice Date", 14, "yyyy-mm-dd"),
        ("Due Date", 14, "yyyy-mm-dd"),
        ("Period Start", 14, "yyyy-mm-dd"),
        ("Period End", 14, "yyyy-mm-dd"),
        ("Amount", 16, "$#,##0.00"),
        ("Approved at", 18, "yyyy-mm-dd hh:mm"),
        ("Paid at", 18, "yyyy-mm-dd hh:mm"),
        ("Rejected at", 18, "yyyy-mm-dd hh:mm"),
        ("Created at", 18, "yyyy-mm-dd hh:mm"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)

    sorted_invoices = sorted(
        invoices,
        key=lambda inv: (
            _vendor_name(vendors_by_id.get(inv.vendor_id)),
            -((inv.invoice_date or datetime.min).timestamp() if inv.invoice_date else 0),
        ),
    )
    for i, inv in enumerate(sorted_invoices, start=header_row + 1):
        v = vendors_by_id.get(inv.vendor_id)
        wo = workorders_by_id.get(inv.work_order_id)
        wo_code = getattr(wo, "work_order_code", None) if wo else None
        status = _enum_value(inv.invoice_status)
        _write_row(
            ws,
            i,
            cols,
            [
                _vendor_name(v),
                inv.id[:8],
                wo_code,
                status,
                _naive(inv.invoice_date),
                _naive(inv.due_date),
                _naive(inv.period_start),
                _naive(inv.period_end),
                float(inv.total_amount or 0),
                _naive(inv.approved_at),
                _naive(inv.paid_at),
                _naive(inv.rejected_at),
                _naive(inv.created_at),
            ],
            status_col=3,
        )
    _finalize_data_sheet(ws, header_row, cols, len(sorted_invoices))


def _write_line_items_sheet(ws_wb, invoices, vendors_by_id):
    ws = ws_wb.create_sheet("Line Items")
    _write_title(ws, "Invoice Line Items", "Every line item, joined back to its invoice and vendor.")

    header_row = 5
    cols = [
        ("Vendor", 30, None),
        ("Invoice #", 12, None),
        ("Line #", 12, None),
        ("Description", 40, None),
        ("Quantity", 12, "#,##0"),
        ("Rate", 14, "$#,##0.00"),
        ("Amount", 16, "$#,##0.00"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)

    rows = []
    for inv in invoices:
        v = vendors_by_id.get(inv.vendor_id)
        for li in inv.line_items or []:
            rows.append(
                [
                    _vendor_name(v),
                    inv.id[:8],
                    li.id[:8],
                    li.description or "",
                    int(li.quantity or 0),
                    float(li.rate or 0),
                    float(li.amount or 0),
                ]
            )
    rows.sort(key=lambda r: (r[0], r[1]))
    for i, row in enumerate(rows, start=header_row + 1):
        _write_row(ws, i, cols, row)
    _finalize_data_sheet(ws, header_row, cols, len(rows))


# ---------------------------------------------------------------------------
# Tickets workbook
# ---------------------------------------------------------------------------


def build_tickets_workbook(start=None, end=None):
    wb = Workbook()
    wb.remove(wb.active)

    tickets = db.session.execute(select(Ticket)).scalars().all()
    if start or end:
        tickets = [t for t in tickets if _in_range(t.created_at, start, end)]
    vendors_by_id = {
        v.id: v for v in db.session.execute(select(Vendor)).scalars().all()
    }
    workorders_by_id = {
        w.id: w for w in db.session.execute(select(WorkOrder)).scalars().all()
    }

    period = _period_label(start, end)
    _write_tickets_summary_sheet(wb, tickets, vendors_by_id, period)
    _write_tickets_by_vendor_sheet(wb, tickets, vendors_by_id, workorders_by_id)
    _write_tickets_flat_sheet(wb, tickets, vendors_by_id, workorders_by_id)
    return _to_workbook_bytes(wb)


def _write_tickets_summary_sheet(ws_wb, tickets, vendors_by_id, period):
    ws = ws_wb.create_sheet("Summary")
    _write_title(ws, "Tickets Summary", f"Period: {period}  ·  {len(tickets)} ticket(s)")

    # By status
    by_status = defaultdict(int)
    by_priority = defaultdict(int)
    by_vendor = defaultdict(int)
    for t in tickets:
        by_status[_enum_value(t.status) or "UNKNOWN"] += 1
        by_priority[_enum_value(t.priority) or "UNKNOWN"] += 1
        by_vendor[t.vendor_id or "unknown"] += 1

    row = 5
    ws.cell(row=row, column=1, value="BY STATUS").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    cols = [("Status", 20, None), ("Count", 12, "#,##0")]
    _apply_widths(ws, cols)
    _write_header(ws, row, cols)
    for status, count in sorted(by_status.items(), key=lambda kv: kv[1], reverse=True):
        row += 1
        _write_row(ws, row, cols, [status, count], status_col=0)

    row += 3
    ws.cell(row=row, column=1, value="BY PRIORITY").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    _write_header(ws, row, cols)
    for priority, count in sorted(by_priority.items(), key=lambda kv: kv[1], reverse=True):
        row += 1
        _write_row(ws, row, cols, [priority, count])

    row += 3
    ws.cell(row=row, column=1, value="BY VENDOR").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    vcols = [("Vendor", 30, None), ("Count", 12, "#,##0")]
    _apply_widths(ws, vcols)
    _write_header(ws, row, vcols)
    for vid, count in sorted(by_vendor.items(), key=lambda kv: kv[1], reverse=True):
        v = vendors_by_id.get(vid)
        row += 1
        _write_row(ws, row, vcols, [_vendor_name(v), count])


def _write_tickets_by_vendor_sheet(ws_wb, tickets, vendors_by_id, workorders_by_id):
    ws = ws_wb.create_sheet("By Vendor")
    _write_title(ws, "Tickets by Vendor", "Each vendor's tickets grouped together with a count subtotal.")

    cols = [
        ("Ticket #", 12, None),
        ("WO #", 10, "#,##0"),
        ("Description", 40, None),
        ("Status", 14, None),
        ("Priority", 12, None),
        ("Assigned Contractor", 24, None),
        ("Due Date", 14, "yyyy-mm-dd"),
        ("Approved", 14, "yyyy-mm-dd"),
        ("Created", 14, "yyyy-mm-dd"),
    ]
    _apply_widths(ws, cols)

    by_vendor = defaultdict(list)
    for t in tickets:
        by_vendor[t.vendor_id or "unknown"].append(t)

    row = 5
    for vid in sorted(by_vendor.keys(), key=lambda x: _vendor_name(vendors_by_id.get(x))):
        v = vendors_by_id.get(vid)
        ts = sorted(by_vendor[vid], key=lambda t: t.created_at or datetime.min, reverse=True)

        banner = ws.cell(row=row, column=1, value=_vendor_name(v))
        banner.font = Font(bold=True, color="FFFFFF", size=12)
        banner.fill = HEADER_FILL
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(cols))
        row += 1

        _write_header(ws, row, cols)
        row += 1

        for t in ts:
            wo = workorders_by_id.get(t.work_order_id)
            wo_code = getattr(wo, "work_order_code", None) if wo else None
            _write_row(
                ws,
                row,
                cols,
                [
                    t.id[:8],
                    wo_code,
                    t.description or "",
                    _enum_value(t.status),
                    _enum_value(t.priority),
                    t.assigned_contractor or "",
                    _naive(t.due_date),
                    _naive(getattr(t, "approved_at", None)),
                    _naive(t.created_at),
                ],
                status_col=3,
            )
            row += 1

        sub = ws.cell(row=row, column=1, value=f"Vendor subtotal: {len(ts)} ticket(s)")
        sub.font = SUBHEADER_FONT
        sub.fill = SUBHEADER_FILL
        sub.border = THIN_BORDER
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(cols))
        row += 2

    ws.freeze_panes = ws["A5"]


def _write_tickets_flat_sheet(ws_wb, tickets, vendors_by_id, workorders_by_id):
    ws = ws_wb.create_sheet("All Tickets (flat)")
    _write_title(ws, "All Tickets", "Sortable, filterable list. Auto-filter on the header row.")

    header_row = 5
    cols = [
        ("Vendor", 30, None),
        ("Ticket #", 12, None),
        ("WO #", 10, "#,##0"),
        ("Description", 40, None),
        ("Status", 14, None),
        ("Priority", 12, None),
        ("Assigned Contractor", 24, None),
        ("Service Type", 18, None),
        ("Due Date", 14, "yyyy-mm-dd"),
        ("Start Time", 18, "yyyy-mm-dd hh:mm"),
        ("End Time", 18, "yyyy-mm-dd hh:mm"),
        ("Approved", 18, "yyyy-mm-dd hh:mm"),
        ("Rejected", 18, "yyyy-mm-dd hh:mm"),
        ("Created", 18, "yyyy-mm-dd hh:mm"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)

    sorted_tickets = sorted(
        tickets,
        key=lambda t: (
            _vendor_name(vendors_by_id.get(t.vendor_id)),
            -(t.created_at.timestamp() if t.created_at else 0),
        ),
    )
    for i, t in enumerate(sorted_tickets, start=header_row + 1):
        v = vendors_by_id.get(t.vendor_id)
        wo = workorders_by_id.get(t.work_order_id)
        wo_code = getattr(wo, "work_order_code", None) if wo else None
        service = getattr(t.service, "service", None) if t.service else None
        _write_row(
            ws,
            i,
            cols,
            [
                _vendor_name(v),
                t.id[:8],
                wo_code,
                t.description or "",
                _enum_value(t.status),
                _enum_value(t.priority),
                t.assigned_contractor or "",
                service or "",
                _naive(t.due_date),
                _naive(t.start_time),
                _naive(t.end_time),
                _naive(getattr(t, "approved_at", None)),
                _naive(getattr(t, "rejected_at", None)),
                _naive(t.created_at),
            ],
            status_col=4,
        )
    _finalize_data_sheet(ws, header_row, cols, len(sorted_tickets))


# ---------------------------------------------------------------------------
# Work Orders workbook
# ---------------------------------------------------------------------------


# =====================================================================
# Work Orders workbook — executive rebuild
# =====================================================================
#
# Tab order (Executive Summary first, set as active on save):
#   1. Executive Summary   — KPIs, top vendors, status mix, watch list
#   2. Work Orders Data    — flat source with derived duration columns
#   3. Vendor Scorecard    — per-vendor formulas vs. flat
#   4. Service Benchmarks  — per-service throughput + duration quartiles
#   5. Duration Analysis   — overall + per-service quartiles, outliers
#   6. Throughput by Hour  — created/completed counts by hour-of-day
#   7. Cost per Hour       — $/hr rates per vendor
#   8. Data Quality        — coverage / null counts / duplicates
#
# All scalar KPIs and per-vendor metrics are Excel formulas pointing at
# the flat tab, so editing rows in place recalculates the whole book.
# Distribution stats (quartiles, hourly counts) are precomputed in
# Python with a one-line note on each tab calling that out.

WO_FLAT_SHEET = "Work Orders Data"
WO_REPORT_TITLE = "Work Orders Report"
WO_HEADER_ROW = 4  # row carrying column titles on Work Orders Data

# Typography per spec
WO_TITLE_FONT = Font(name="Arial", size=18, bold=True, color="0F172A")
WO_TAB_TITLE_FONT = Font(name="Arial", size=14, bold=True, color="1F2937")
WO_HEADER_FONT_BOLD = Font(name="Arial", size=11, bold=True, color="FFFFFF")
WO_BODY_FONT = Font(name="Arial", size=10, color="0F172A")
WO_KPI_VALUE_FONT = Font(name="Arial", size=16, bold=True, color="0F172A")
WO_KPI_LABEL_FONT = Font(name="Arial", size=9, color="6B7280")
WO_NOTE_FONT = Font(name="Arial", size=9, italic=True, color="6B7280")
WO_SECTION_FONT = Font(name="Arial", size=11, bold=True, color="1F3A8A")

# Muted, print-friendly fills
WO_HEADER_FILL = PatternFill("solid", fgColor="1F3A8A")          # navy
WO_SECTION_FILL = PatternFill("solid", fgColor="EEF2FF")         # ice
WO_BAND_FILL = PatternFill("solid", fgColor="F8FAFC")            # band
WO_GREEN_FILL = PatternFill("solid", fgColor="DCFCE7")           # completed
WO_AMBER_FILL = PatternFill("solid", fgColor="FEF3C7")           # in-progress
WO_RED_FILL = PatternFill("solid", fgColor="FEE2E2")             # halted/cancelled
WO_SLATE_FILL = PatternFill("solid", fgColor="F1F5F9")           # closed/neutral

# Number formats per spec
FMT_CURRENCY = '$#,##0;($#,##0);-'
FMT_CURRENCY_DEC = '$#,##0.00;($#,##0.00);-'
FMT_PCT = '0.0%;(0.0%);-'
FMT_HOURS = '#,##0.0'
FMT_INT = '#,##0;(#,##0);-'
FMT_DATE = 'yyyy-mm-dd'
FMT_DATETIME = 'yyyy-mm-dd hh:mm'

# Status colour map (red/amber/green/slate; grayscale-safe)
WO_STATUS_FILLS = {
    "COMPLETED": WO_GREEN_FILL,
    "CLOSED": WO_GREEN_FILL,
    "ASSIGNED": WO_AMBER_FILL,
    "IN_PROGRESS": WO_AMBER_FILL,
    "PENDING": WO_AMBER_FILL,
    "UNASSIGNED": WO_SLATE_FILL,
    "HALTED": WO_RED_FILL,
    "CANCELLED": WO_RED_FILL,
    "REJECTED": WO_RED_FILL,
}


def _wo_quoted(name):
    """Return sheet name quoted for use in formulas."""
    return f"'{name}'"


def _wo_print_setup(ws, period, tab_name, gridlines=True):
    """Apply the workbook-wide print spec to a single tab."""
    # Letter size + landscape if wide tab; orientation set by caller via
    # ws.page_setup.orientation before calling. Default landscape.
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    if not ws.page_setup.orientation:
        ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(
        left=0.5, right=0.5, top=0.75, bottom=0.75, header=0.3, footer=0.3
    )
    ws.print_options.gridLines = gridlines
    ws.print_options.gridLinesSet = gridlines
    ws.print_options.horizontalCentered = True
    ws.oddHeader.left.text = WO_REPORT_TITLE
    ws.oddHeader.left.size = 9
    ws.oddHeader.center.text = tab_name
    ws.oddHeader.center.size = 9
    ws.oddHeader.right.text = f"Period: {period}"
    ws.oddHeader.right.size = 9
    ws.oddFooter.left.text = (
        f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC"
    )
    ws.oddFooter.left.size = 9
    ws.oddFooter.center.text = "Confidential - Internal Use Only"
    ws.oddFooter.center.size = 9
    ws.oddFooter.right.text = "Page &P of &N"
    ws.oddFooter.right.size = 9


def _wo_set_print_area(ws, last_col_letter, last_row):
    """Constrain the print area to actual data extents."""
    ws.print_area = f"A1:{last_col_letter}{last_row}"


def _wo_band_rows(ws, first_data_row, last_data_row, last_col):
    """Apply alternating row banding without using fills that override
    conditional formatting on status columns."""
    for r in range(first_data_row, last_data_row + 1):
        if (r - first_data_row) % 2 == 1:
            for c in range(1, last_col + 1):
                cell = ws.cell(row=r, column=c)
                if cell.fill is None or cell.fill.fgColor is None or cell.fill.fgColor.value in (None, "00000000"):
                    cell.fill = WO_BAND_FILL


def _wo_apply_status_cf(ws, status_col_letter, first_row, last_row):
    """Red/amber/green status fills that print legibly in grayscale."""
    rng = f"{status_col_letter}{first_row}:{status_col_letter}{last_row}"
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="equal", formula=['"COMPLETED"'], fill=WO_GREEN_FILL),
    )
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="equal", formula=['"CLOSED"'], fill=WO_GREEN_FILL),
    )
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="equal", formula=['"ASSIGNED"'], fill=WO_AMBER_FILL),
    )
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="equal", formula=['"IN_PROGRESS"'], fill=WO_AMBER_FILL),
    )
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="equal", formula=['"HALTED"'], fill=WO_RED_FILL),
    )
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="equal", formula=['"CANCELLED"'], fill=WO_RED_FILL),
    )
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="equal", formula=['"REJECTED"'], fill=WO_RED_FILL),
    )


def _wo_data_bar(ws, col_letter, first_row, last_row, color="64748B"):
    """Print-friendly slate data bar."""
    ws.conditional_formatting.add(
        f"{col_letter}{first_row}:{col_letter}{last_row}",
        DataBarRule(
            start_type="min",
            end_type="max",
            color=color,
            showValue=True,
            minLength=0,
            maxLength=100,
        ),
    )


def build_workorders_workbook(start=None, end=None):
    """Executive-quality work orders workbook.

    See the section banner above for tab order and design intent.
    """
    wb = Workbook()
    wb.remove(wb.active)

    work_orders = db.session.execute(select(WorkOrder)).scalars().all()
    if start or end:
        work_orders = [w for w in work_orders if _in_range(w.created_at, start, end)]
    vendors_by_id = {v.id: v for v in db.session.execute(select(Vendor)).scalars().all()}
    clients_by_id = {c.id: c for c in db.session.execute(select(Client)).scalars().all()}

    period = _period_label(start, end)
    n = len(work_orders)

    # Build flat data first so the other tabs can reference it.
    flat_last_data_row = _wo_write_flat(wb, work_orders, vendors_by_id, clients_by_id)

    _wo_write_exec_summary(wb, work_orders, vendors_by_id, period, flat_last_data_row)
    _wo_write_vendor_scorecard(wb, work_orders, vendors_by_id, flat_last_data_row)
    _wo_write_service_benchmarks(wb, work_orders)
    _wo_write_duration_analysis(wb, work_orders)
    _wo_write_throughput_by_hour(wb, work_orders)
    _wo_write_cost_per_hour(wb, work_orders, vendors_by_id, flat_last_data_row)
    _wo_write_data_quality(wb, work_orders, flat_last_data_row)

    # Move Executive Summary to position 0 (it's currently created after flat).
    exec_idx = wb.sheetnames.index("Executive Summary")
    if exec_idx != 0:
        wb.move_sheet("Executive Summary", offset=-exec_idx)

    wb.active = 0
    exec_ws = wb["Executive Summary"]
    exec_ws.sheet_view.zoomScale = 100
    exec_ws.sheet_view.selection[0].activeCell = "A1"
    exec_ws.sheet_view.selection[0].sqref = "A1"

    # Apply print setup last so every tab is configured.
    for ws in wb.worksheets:
        if ws.title == "Executive Summary":
            ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT
            _wo_print_setup(ws, period, ws.title, gridlines=False)
        else:
            ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
            _wo_print_setup(ws, period, ws.title, gridlines=True)

    return _to_workbook_bytes(wb)


# ---------------------------------------------------------------------
# 2. Work Orders Data (flat) — source of truth
# ---------------------------------------------------------------------

def _wo_write_flat(wb, work_orders, vendors_by_id, clients_by_id):
    ws = wb.create_sheet(WO_FLAT_SHEET)
    note = (
        "Source-of-truth flat list. Columns AC-AH are derived in-cell from the "
        "timestamps to the left (durations in hours, variance, lead time, on-time)."
    )
    ws.cell(row=1, column=1, value="Work Orders - source data").font = WO_TAB_TITLE_FONT
    ws.cell(row=2, column=1, value=note).font = WO_NOTE_FONT
    ws.cell(
        row=3,
        column=1,
        value=f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
    ).font = WO_NOTE_FONT

    cols = [
        ("Client", 26, None),
        ("Vendor", 28, None),
        ("WO #", 10, FMT_INT),
        ("Description", 38, None),
        ("Status", 14, None),
        ("Priority", 10, None),
        ("Service", 18, None),
        ("Location Type", 14, None),
        ("Location", 26, None),
        ("Latitude", 12, "#,##0.000000"),
        ("Longitude", 12, "#,##0.000000"),
        ("Well ID", 36, None),
        ("Est Cost", 14, FMT_CURRENCY),
        ("Est Quantity", 12, "#,##0.00"),
        ("Units", 8, None),
        ("Recurring?", 10, None),
        ("Recurrence", 12, None),
        ("Estimated Start", 16, FMT_DATE),
        ("Estimated End", 16, FMT_DATE),
        ("Assigned At", 16, FMT_DATETIME),
        ("Completed At", 16, FMT_DATETIME),
        ("Closed At", 16, FMT_DATETIME),
        ("Halted At", 16, FMT_DATETIME),
        ("Rejected At", 16, FMT_DATETIME),
        ("Created", 16, FMT_DATETIME),
        ("Updated", 16, FMT_DATETIME),
        ("Cancelled At", 16, FMT_DATETIME),
        ("Cancellation Reason", 28, None),
        ("Actual Duration (hrs)", 14, FMT_HOURS),
        ("Estimated Duration (hrs)", 14, FMT_HOURS),
        ("Variance (hrs)", 12, FMT_HOURS),
        ("Variance %", 12, FMT_PCT),
        ("Lead Time (hrs)", 14, FMT_HOURS),
        ("On Time?", 10, None),
    ]
    _apply_widths(ws, cols)

    header_row = WO_HEADER_ROW
    for c_idx, (label, _w, _f) in enumerate(cols, start=1):
        cell = ws.cell(row=header_row, column=c_idx, value=label)
        cell.font = WO_HEADER_FONT_BOLD
        cell.fill = WO_HEADER_FILL
        cell.alignment = Alignment(horizontal="left", vertical="center")
        cell.border = THIN_BORDER

    sorted_wos = sorted(
        work_orders,
        key=lambda w: (
            _vendor_name(vendors_by_id.get(w.assigned_vendor)),
            -(w.created_at.timestamp() if w.created_at else 0),
        ),
    )
    for offset, w in enumerate(sorted_wos):
        row = header_row + 1 + offset
        v = vendors_by_id.get(w.assigned_vendor)
        c = clients_by_id.get(w.client_id) if w.client_id else None
        client_name = getattr(c, "client_name", None) if c else None
        service = w.service.service if getattr(w, "service", None) else None
        location_str = getattr(w, "location", None) or (
            f"{w.latitude}, {w.longitude}"
            if getattr(w, "latitude", None) is not None and getattr(w, "longitude", None) is not None
            else ""
        )
        lat = getattr(w, "latitude", None)
        lng = getattr(w, "longitude", None)

        # T = Assigned At (col 20), U = Completed At (col 21), R = Estimated Start (col 18),
        # S = Estimated End (col 19), Y = Created (col 25)
        actual_dur = (
            f'=IF(AND(T{row}<>"",U{row}<>""),(U{row}-T{row})*24,"")'
        )
        est_dur = (
            f'=IF(AND(R{row}<>"",S{row}<>""),(S{row}-R{row})*24,"")'
        )
        variance = (
            f'=IF(AND(AC{row}<>"",AD{row}<>""),AC{row}-AD{row},"")'
        )
        variance_pct = (
            f'=IF(AND(AC{row}<>"",AD{row}<>"",AD{row}>0),'
            f'(AC{row}-AD{row})/AD{row},"")'
        )
        lead_time = (
            f'=IF(AND(Y{row}<>"",T{row}<>""),(T{row}-Y{row})*24,"")'
        )
        on_time = (
            f'=IF(AND(U{row}<>"",S{row}<>""),'
            f'IF(U{row}<=S{row},"Yes","No"),"")'
        )

        values = [
            client_name or "",
            _vendor_name(v),
            getattr(w, "work_order_code", None),
            w.description or "",
            _enum_value(getattr(w, "current_status", None)),
            _enum_value(getattr(w, "priority", None)),
            service or "",
            _enum_value(getattr(w, "location_type", None)) or "",
            location_str,
            float(lat) if lat is not None else None,
            float(lng) if lng is not None else None,
            getattr(w, "well_id", None) or "",
            float(getattr(w, "estimated_cost", 0) or 0),
            float(getattr(w, "estimated_quantity", 0) or 0),
            getattr(w, "units", None) or "",
            "Yes" if getattr(w, "is_recurring", False) else "No",
            _enum_value(getattr(w, "recurrence_type", None)) or "",
            _naive(getattr(w, "estimated_start_date", None)),
            _naive(getattr(w, "estimated_end_date", None)),
            _naive(getattr(w, "assigned_at", None)),
            _naive(getattr(w, "completed_at", None)),
            _naive(getattr(w, "closed_at", None)),
            _naive(getattr(w, "halted_at", None)),
            _naive(getattr(w, "rejected_at", None)),
            _naive(w.created_at),
            _naive(getattr(w, "updated_at", None)),
            _naive(getattr(w, "cancelled_at", None)),
            getattr(w, "cancellation_reason", None) or "",
            actual_dur,
            est_dur,
            variance,
            variance_pct,
            lead_time,
            on_time,
        ]

        for c_idx, ((_, _w, fmt), value) in enumerate(zip(cols, values), start=1):
            cell = ws.cell(row=row, column=c_idx, value=value)
            if fmt:
                cell.number_format = fmt
            cell.font = WO_BODY_FONT
            cell.border = THIN_BORDER

    last_data_row = header_row + len(sorted_wos)
    last_col = len(cols)
    last_col_letter = get_column_letter(last_col)

    if sorted_wos:
        ws.auto_filter.ref = f"A{header_row}:{last_col_letter}{last_data_row}"
        ws.freeze_panes = ws[f"A{header_row + 1}"]
        _wo_apply_status_cf(ws, "E", header_row + 1, last_data_row)
        _wo_data_bar(ws, "M", header_row + 1, last_data_row)
        _wo_data_bar(ws, "AC", header_row + 1, last_data_row, color="334155")
        # Highlight rows where the variance ratio is >= 50% over estimate.
        ws.conditional_formatting.add(
            f"AF{header_row + 1}:AF{last_data_row}",
            CellIsRule(operator="greaterThanOrEqual", formula=["0.5"], fill=WO_RED_FILL),
        )

    ws.print_title_rows = f"1:{header_row}"
    _wo_set_print_area(ws, last_col_letter, max(last_data_row, header_row))
    return last_data_row


# ---------------------------------------------------------------------
# 1. Executive Summary
# ---------------------------------------------------------------------

def _wo_write_exec_summary(wb, work_orders, vendors_by_id, period, flat_last_row):
    ws = wb.create_sheet("Executive Summary")
    flat = _wo_quoted(WO_FLAT_SHEET)
    n = len(work_orders)

    # Layout:
    #   Row 1: report title (Arial 18 bold)
    #   Row 2: period
    #   Row 3: generated timestamp + record count
    #   Row 4: blank
    #   Row 5: "what changed" paragraph (omitted cleanly if no prior period)
    #   Row 7+: KPI cards (label/value pairs in a grid)
    #   Then Status mix, Top 5 vendors by spend, Watch list

    ws.merge_cells("A1:F1")
    ws["A1"] = WO_REPORT_TITLE
    ws["A1"].font = WO_TITLE_FONT
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center")

    ws["A2"] = f"Period: {period}    ·    {n:,} work order(s)"
    ws["A2"].font = WO_NOTE_FONT

    ws["A3"] = (
        f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    ws["A3"].font = WO_NOTE_FONT

    # KPI grid (no merged cells inside data ranges; merges are in title only)
    kpi_row = 6
    kpi_specs = [
        ("Total work orders",
         f"=COUNTA({flat}!C{WO_HEADER_ROW + 1}:C{flat_last_row})", FMT_INT),
        ("Total estimated cost",
         f"=SUM({flat}!M{WO_HEADER_ROW + 1}:M{flat_last_row})", FMT_CURRENCY),
        ("Average actual duration (hrs)",
         f'=IFERROR(AVERAGE({flat}!AC{WO_HEADER_ROW + 1}:AC{flat_last_row}),0)',
         FMT_HOURS),
        ("Average variance vs estimate",
         f'=IFERROR(AVERAGE({flat}!AF{WO_HEADER_ROW + 1}:AF{flat_last_row}),0)',
         FMT_PCT),
        ("On-time completion rate",
         f'=IFERROR(COUNTIF({flat}!AH{WO_HEADER_ROW + 1}:AH{flat_last_row},"Yes")'
         f'/(COUNTIF({flat}!AH{WO_HEADER_ROW + 1}:AH{flat_last_row},"Yes")'
         f'+COUNTIF({flat}!AH{WO_HEADER_ROW + 1}:AH{flat_last_row},"No")),0)',
         FMT_PCT),
        ("Halted / cancelled count",
         f'=COUNTIF({flat}!E{WO_HEADER_ROW + 1}:E{flat_last_row},"HALTED")'
         f'+COUNTIF({flat}!E{WO_HEADER_ROW + 1}:E{flat_last_row},"CANCELLED")',
         FMT_INT),
    ]

    # 3 columns x 2 rows of KPI cards
    for idx, (label, formula, fmt) in enumerate(kpi_specs):
        col = (idx % 3) * 2 + 1   # cols 1, 3, 5
        row = kpi_row + (idx // 3) * 3
        label_cell = ws.cell(row=row, column=col, value=label)
        label_cell.font = WO_KPI_LABEL_FONT
        value_cell = ws.cell(row=row + 1, column=col, value=formula)
        value_cell.font = WO_KPI_VALUE_FONT
        value_cell.number_format = fmt
        for c in (label_cell, value_cell):
            c.border = THIN_BORDER

    for col_letter in ("A", "B", "C", "D", "E", "F"):
        ws.column_dimensions[col_letter].width = 22

    # ----- Status breakdown -----
    section_row = kpi_row + 7
    ws.cell(row=section_row, column=1, value="STATUS BREAKDOWN").font = WO_SECTION_FONT
    ws.cell(row=section_row, column=1).fill = WO_SECTION_FILL
    section_row += 1
    cols = [("Status", 22, None), ("Count", 12, FMT_INT), ("Share", 10, FMT_PCT)]
    for c_idx, (label, _w, _f) in enumerate(cols, start=1):
        h = ws.cell(row=section_row, column=c_idx, value=label)
        h.font = WO_HEADER_FONT_BOLD
        h.fill = WO_HEADER_FILL

    statuses = [
        "UNASSIGNED", "PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED",
        "CLOSED", "HALTED", "CANCELLED", "REJECTED",
    ]
    total_formula = f"COUNTA({flat}!E{WO_HEADER_ROW + 1}:E{flat_last_row})"
    for i, status in enumerate(statuses):
        r = section_row + 1 + i
        ws.cell(row=r, column=1, value=status).font = WO_BODY_FONT
        ws.cell(
            row=r, column=2,
            value=f'=COUNTIF({flat}!E{WO_HEADER_ROW + 1}:E{flat_last_row},"{status}")',
        ).number_format = FMT_INT
        ws.cell(
            row=r, column=3,
            value=f'=IFERROR(COUNTIF({flat}!E{WO_HEADER_ROW + 1}:E{flat_last_row},"{status}")/{total_formula},0)',
        ).number_format = FMT_PCT
    status_last = section_row + len(statuses)

    # ----- Top 5 vendors by spend (precomputed; vendor names live on flat) -----
    section_row = status_last + 3
    ws.cell(row=section_row, column=1, value="TOP 5 VENDORS BY ESTIMATED SPEND").font = WO_SECTION_FONT
    ws.cell(row=section_row, column=1).fill = WO_SECTION_FILL
    section_row += 1
    for c_idx, label in enumerate(["Vendor", "WO Count", "Est Total"], start=1):
        h = ws.cell(row=section_row, column=c_idx, value=label)
        h.font = WO_HEADER_FONT_BOLD
        h.fill = WO_HEADER_FILL

    spend_by_vendor = defaultdict(lambda: {"count": 0, "value": 0.0, "name": ""})
    for w in work_orders:
        if not w.assigned_vendor:
            continue
        slot = spend_by_vendor[w.assigned_vendor]
        slot["count"] += 1
        slot["value"] += float(getattr(w, "estimated_cost", 0) or 0)
        slot["name"] = _vendor_name(vendors_by_id.get(w.assigned_vendor))
    top_vendors = sorted(spend_by_vendor.values(), key=lambda x: x["value"], reverse=True)[:5]
    for i, slot in enumerate(top_vendors):
        r = section_row + 1 + i
        ws.cell(row=r, column=1, value=slot["name"]).font = WO_BODY_FONT
        ws.cell(row=r, column=2, value=slot["count"]).number_format = FMT_INT
        ws.cell(row=r, column=3, value=slot["value"]).number_format = FMT_CURRENCY
    top_last = section_row + max(len(top_vendors), 1)

    # ----- Watch list: halted / cancelled / >7d open / variance >= 50% -----
    section_row = top_last + 3
    ws.cell(row=section_row, column=1, value="WATCH LIST").font = WO_SECTION_FONT
    ws.cell(row=section_row, column=1).fill = WO_SECTION_FILL
    section_row += 1
    watch_cols = [("Indicator", 38, None), ("Count", 12, FMT_INT)]
    for c_idx, (label, _w, _f) in enumerate(watch_cols, start=1):
        h = ws.cell(row=section_row, column=c_idx, value=label)
        h.font = WO_HEADER_FONT_BOLD
        h.fill = WO_HEADER_FILL

    watch_specs = [
        ("Work orders currently HALTED",
         f'=COUNTIF({flat}!E{WO_HEADER_ROW + 1}:E{flat_last_row},"HALTED")'),
        ("Work orders currently CANCELLED",
         f'=COUNTIF({flat}!E{WO_HEADER_ROW + 1}:E{flat_last_row},"CANCELLED")'),
        ("Work orders REJECTED",
         f'=COUNTIF({flat}!E{WO_HEADER_ROW + 1}:E{flat_last_row},"REJECTED")'),
        ("Late completions (On Time = No)",
         f'=COUNTIF({flat}!AH{WO_HEADER_ROW + 1}:AH{flat_last_row},"No")'),
        ("Variance >= 50% over estimate",
         f'=COUNTIFS({flat}!AF{WO_HEADER_ROW + 1}:AF{flat_last_row},">=0.5")'),
    ]
    for i, (label, formula) in enumerate(watch_specs):
        r = section_row + 1 + i
        ws.cell(row=r, column=1, value=label).font = WO_BODY_FONT
        ws.cell(row=r, column=2, value=formula).number_format = FMT_INT


# ---------------------------------------------------------------------
# 3. Vendor Scorecard
# ---------------------------------------------------------------------

def _wo_write_vendor_scorecard(wb, work_orders, vendors_by_id, flat_last_row):
    ws = wb.create_sheet("Vendor Scorecard")
    flat = _wo_quoted(WO_FLAT_SHEET)
    note = (
        "Per-vendor performance vs the flat data tab. All metrics are formulas; "
        "edit rows in 'Work Orders Data' and this tab recalculates."
    )
    ws.cell(row=1, column=1, value="Vendor Scorecard").font = WO_TAB_TITLE_FONT
    ws.cell(row=2, column=1, value=note).font = WO_NOTE_FONT
    ws.cell(
        row=3, column=1,
        value=f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
    ).font = WO_NOTE_FONT

    cols = [
        ("Vendor", 30, None),
        ("WO Count", 10, FMT_INT),
        ("Total Est Cost", 14, FMT_CURRENCY),
        ("Avg Actual Duration (hrs)", 16, FMT_HOURS),
        ("Avg Estimated Duration (hrs)", 16, FMT_HOURS),
        ("Avg Variance %", 14, FMT_PCT),
        ("On-Time %", 12, FMT_PCT),
        ("Halt/Cancel Count", 14, FMT_INT),
        ("Halt/Cancel Rate", 14, FMT_PCT),
    ]
    _apply_widths(ws, cols)
    header_row = 4
    for c_idx, (label, _w, _f) in enumerate(cols, start=1):
        cell = ws.cell(row=header_row, column=c_idx, value=label)
        cell.font = WO_HEADER_FONT_BOLD
        cell.fill = WO_HEADER_FILL
        cell.border = THIN_BORDER

    vendor_names = sorted(
        {_vendor_name(vendors_by_id.get(w.assigned_vendor)) for w in work_orders if w.assigned_vendor}
    )

    flat_rows = (WO_HEADER_ROW + 1, flat_last_row)
    a, b = flat_rows
    for i, name in enumerate(vendor_names):
        r = header_row + 1 + i
        v_ref = f'A{r}'
        ws.cell(row=r, column=1, value=name).font = WO_BODY_FONT
        ws.cell(row=r, column=2,
                value=f'=COUNTIF({flat}!B{a}:B{b},{v_ref})').number_format = FMT_INT
        ws.cell(row=r, column=3,
                value=f'=SUMIF({flat}!B{a}:B{b},{v_ref},{flat}!M{a}:M{b})').number_format = FMT_CURRENCY
        ws.cell(row=r, column=4,
                value=f'=IFERROR(AVERAGEIFS({flat}!AC{a}:AC{b},{flat}!B{a}:B{b},{v_ref},{flat}!AC{a}:AC{b},">0"),0)'
                ).number_format = FMT_HOURS
        ws.cell(row=r, column=5,
                value=f'=IFERROR(AVERAGEIFS({flat}!AD{a}:AD{b},{flat}!B{a}:B{b},{v_ref},{flat}!AD{a}:AD{b},">0"),0)'
                ).number_format = FMT_HOURS
        ws.cell(row=r, column=6,
                value=f'=IFERROR(AVERAGEIFS({flat}!AF{a}:AF{b},{flat}!B{a}:B{b},{v_ref},{flat}!AF{a}:AF{b},"<>"),0)'
                ).number_format = FMT_PCT
        ws.cell(row=r, column=7,
                value=(
                    f'=IFERROR('
                    f'COUNTIFS({flat}!B{a}:B{b},{v_ref},{flat}!AH{a}:AH{b},"Yes")'
                    f'/(COUNTIFS({flat}!B{a}:B{b},{v_ref},{flat}!AH{a}:AH{b},"Yes")'
                    f'+COUNTIFS({flat}!B{a}:B{b},{v_ref},{flat}!AH{a}:AH{b},"No")),0)'
                )).number_format = FMT_PCT
        ws.cell(row=r, column=8,
                value=(
                    f'=COUNTIFS({flat}!B{a}:B{b},{v_ref},{flat}!E{a}:E{b},"HALTED")'
                    f'+COUNTIFS({flat}!B{a}:B{b},{v_ref},{flat}!E{a}:E{b},"CANCELLED")'
                )).number_format = FMT_INT
        ws.cell(row=r, column=9,
                value=(
                    f'=IFERROR(('
                    f'COUNTIFS({flat}!B{a}:B{b},{v_ref},{flat}!E{a}:E{b},"HALTED")'
                    f'+COUNTIFS({flat}!B{a}:B{b},{v_ref},{flat}!E{a}:E{b},"CANCELLED"))'
                    f'/COUNTIF({flat}!B{a}:B{b},{v_ref}),0)'
                )).number_format = FMT_PCT
        for c_idx in range(1, len(cols) + 1):
            ws.cell(row=r, column=c_idx).border = THIN_BORDER

    last_row = header_row + len(vendor_names)
    if vendor_names:
        ws.auto_filter.ref = f"A{header_row}:I{last_row}"
        ws.freeze_panes = ws[f"A{header_row + 1}"]
        # Halt/cancel rate red bar
        ws.conditional_formatting.add(
            f"I{header_row + 1}:I{last_row}",
            CellIsRule(operator="greaterThanOrEqual", formula=["0.1"], fill=WO_RED_FILL),
        )
        _wo_data_bar(ws, "C", header_row + 1, last_row)
    ws.print_title_rows = f"1:{header_row}"
    _wo_set_print_area(ws, "I", max(last_row, header_row))


# ---------------------------------------------------------------------
# 4. Service Type Benchmarks
# ---------------------------------------------------------------------

def _wo_durations_for(filter_fn, work_orders):
    out = []
    for w in work_orders:
        if not filter_fn(w):
            continue
        a = getattr(w, "assigned_at", None)
        c = getattr(w, "completed_at", None)
        if a and c:
            hrs = (c - a).total_seconds() / 3600.0
            if hrs > 0:
                out.append(hrs)
    return out


def _quartiles(values):
    if not values:
        return (0, 0, 0, 0, 0, 0)
    if len(values) == 1:
        v = values[0]
        return (v, v, v, v, v, v)
    sorted_vals = sorted(values)
    try:
        q = quantiles(sorted_vals, n=4, method="inclusive")
        p25, med, p75 = q[0], q[1], q[2]
    except Exception:
        med = median(sorted_vals)
        p25 = sorted_vals[len(sorted_vals) // 4]
        p75 = sorted_vals[(3 * len(sorted_vals)) // 4]
    # p90
    try:
        p90 = quantiles(sorted_vals, n=10, method="inclusive")[8]
    except Exception:
        p90 = sorted_vals[int(len(sorted_vals) * 0.9)]
    return (sorted_vals[0], p25, med, p75, p90, sorted_vals[-1])


def _wo_write_service_benchmarks(wb, work_orders):
    ws = wb.create_sheet("Service Benchmarks")
    note = (
        "Per service type: count, total estimated cost, throughput vs the "
        "period, and duration quartiles. Quartiles are computed in Python "
        "from the data shipped in this workbook (snapshot at generation)."
    )
    ws.cell(row=1, column=1, value="Service Type Benchmarks").font = WO_TAB_TITLE_FONT
    ws.cell(row=2, column=1, value=note).font = WO_NOTE_FONT
    ws.cell(
        row=3, column=1,
        value=f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
    ).font = WO_NOTE_FONT

    cols = [
        ("Service", 24, None),
        ("Count", 10, FMT_INT),
        ("Total Est Cost", 16, FMT_CURRENCY),
        ("Avg Duration (hrs)", 16, FMT_HOURS),
        ("Min", 8, FMT_HOURS),
        ("p25", 8, FMT_HOURS),
        ("Median", 10, FMT_HOURS),
        ("p75", 8, FMT_HOURS),
        ("p90", 8, FMT_HOURS),
        ("Max", 10, FMT_HOURS),
        ("Outliers (>2x median)", 16, FMT_INT),
    ]
    _apply_widths(ws, cols)
    header_row = 4
    for c_idx, (label, _w, _f) in enumerate(cols, start=1):
        cell = ws.cell(row=header_row, column=c_idx, value=label)
        cell.font = WO_HEADER_FONT_BOLD
        cell.fill = WO_HEADER_FILL
        cell.border = THIN_BORDER

    services = sorted(
        {(w.service.service if getattr(w, "service", None) else "(no service)")
         for w in work_orders}
    )
    row = header_row
    for svc in services:
        row += 1
        same = [w for w in work_orders
                if (getattr(w.service, "service", None) if getattr(w, "service", None) else "(no service)") == svc]
        durs = _wo_durations_for(
            lambda w, _svc=svc: ((getattr(w.service, "service", None) if getattr(w, "service", None) else "(no service)") == _svc),
            work_orders,
        )
        total_cost = sum(float(getattr(w, "estimated_cost", 0) or 0) for w in same)
        avg = sum(durs) / len(durs) if durs else 0
        mn, p25, med, p75, p90, mx = _quartiles(durs)
        outliers = sum(1 for d in durs if med and d > 2 * med)
        values = [svc, len(same), total_cost, avg, mn, p25, med, p75, p90, mx, outliers]
        for c_idx, ((_, _w, fmt), val) in enumerate(zip(cols, values), start=1):
            cell = ws.cell(row=row, column=c_idx, value=val)
            if fmt:
                cell.number_format = fmt
            cell.font = WO_BODY_FONT
            cell.border = THIN_BORDER

    last_row = row
    if services:
        ws.auto_filter.ref = f"A{header_row}:K{last_row}"
        ws.freeze_panes = ws[f"A{header_row + 1}"]
        _wo_data_bar(ws, "C", header_row + 1, last_row)
        _wo_data_bar(ws, "G", header_row + 1, last_row, color="334155")
    ws.print_title_rows = f"1:{header_row}"
    _wo_set_print_area(ws, "K", max(last_row, header_row))


# ---------------------------------------------------------------------
# 5. Duration Analysis (overall)
# ---------------------------------------------------------------------

def _wo_write_duration_analysis(wb, work_orders):
    ws = wb.create_sheet("Duration Analysis")
    note = (
        "Overall duration distribution across all work orders with both "
        "timestamps. Outliers are jobs longer than 2x the overall median."
    )
    ws.cell(row=1, column=1, value="Duration Analysis").font = WO_TAB_TITLE_FONT
    ws.cell(row=2, column=1, value=note).font = WO_NOTE_FONT
    ws.cell(
        row=3, column=1,
        value=f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
    ).font = WO_NOTE_FONT

    durs = _wo_durations_for(lambda w: True, work_orders)
    mn, p25, med, p75, p90, mx = _quartiles(durs)
    avg = sum(durs) / len(durs) if durs else 0
    excluded = len(work_orders) - len(durs)

    rows = [
        ("Jobs included (have assigned + completed)", len(durs), FMT_INT),
        ("Jobs excluded (open or never assigned)", excluded, FMT_INT),
        ("Average duration (hrs)", avg, FMT_HOURS),
        ("Min", mn, FMT_HOURS),
        ("p25", p25, FMT_HOURS),
        ("Median", med, FMT_HOURS),
        ("p75", p75, FMT_HOURS),
        ("p90", p90, FMT_HOURS),
        ("Max", mx, FMT_HOURS),
        ("Outliers (>2x median)", sum(1 for d in durs if med and d > 2 * med), FMT_INT),
    ]
    for c_idx, (label, val, fmt) in enumerate(rows):
        r = 5 + c_idx
        l = ws.cell(row=r, column=1, value=label)
        l.font = WO_BODY_FONT
        v = ws.cell(row=r, column=2, value=val)
        v.font = WO_KPI_VALUE_FONT
        v.number_format = fmt
    ws.column_dimensions["A"].width = 44
    ws.column_dimensions["B"].width = 18
    ws.print_title_rows = "1:4"
    _wo_set_print_area(ws, "B", 4 + len(rows))


# ---------------------------------------------------------------------
# 6. Throughput by Hour
# ---------------------------------------------------------------------

def _wo_write_throughput_by_hour(wb, work_orders):
    ws = wb.create_sheet("Throughput by Hour")
    note = (
        "Created and completed counts per hour-of-day across the period, "
        "showing when activity is concentrated. Throughput = jobs / unit time."
    )
    ws.cell(row=1, column=1, value="Throughput by Hour-of-Day").font = WO_TAB_TITLE_FONT
    ws.cell(row=2, column=1, value=note).font = WO_NOTE_FONT
    ws.cell(
        row=3, column=1,
        value=f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
    ).font = WO_NOTE_FONT

    cols = [
        ("Hour (UTC)", 10, "00"),
        ("Created", 10, FMT_INT),
        ("Completed", 10, FMT_INT),
        ("Per-minute (created)", 14, "0.000"),
        ("Per-30min (created)", 14, "0.00"),
        ("Per-hour (created)", 14, "0.00"),
    ]
    _apply_widths(ws, cols)
    header_row = 4
    for c_idx, (label, _w, _f) in enumerate(cols, start=1):
        cell = ws.cell(row=header_row, column=c_idx, value=label)
        cell.font = WO_HEADER_FONT_BOLD
        cell.fill = WO_HEADER_FILL
        cell.border = THIN_BORDER

    created_by_h = defaultdict(int)
    completed_by_h = defaultdict(int)
    for w in work_orders:
        if w.created_at:
            created_by_h[w.created_at.hour] += 1
        completed = getattr(w, "completed_at", None)
        if completed:
            completed_by_h[completed.hour] += 1

    for h in range(24):
        r = header_row + 1 + h
        c_count = created_by_h.get(h, 0)
        cells = [
            (1, h, "00"),
            (2, c_count, FMT_INT),
            (3, completed_by_h.get(h, 0), FMT_INT),
            (4, c_count / 60.0, "0.000"),
            (5, c_count / 2.0, "0.00"),
            (6, float(c_count), "0.00"),
        ]
        for col, val, fmt in cells:
            cell = ws.cell(row=r, column=col, value=val)
            cell.number_format = fmt
            cell.font = WO_BODY_FONT
            cell.border = THIN_BORDER

    last_row = header_row + 24
    ws.auto_filter.ref = f"A{header_row}:F{last_row}"
    ws.freeze_panes = ws[f"A{header_row + 1}"]
    _wo_data_bar(ws, "B", header_row + 1, last_row)
    _wo_data_bar(ws, "C", header_row + 1, last_row, color="64748B")
    ws.print_title_rows = f"1:{header_row}"
    _wo_set_print_area(ws, "F", last_row)


# ---------------------------------------------------------------------
# 7. Cost per Hour (per vendor)
# ---------------------------------------------------------------------

def _wo_write_cost_per_hour(wb, work_orders, vendors_by_id, flat_last_row):
    ws = wb.create_sheet("Cost per Hour")
    flat = _wo_quoted(WO_FLAT_SHEET)
    note = (
        "$/hr by vendor: total estimated cost / total actual duration hours "
        "(jobs without both assigned + completed timestamps are excluded). "
        "Per-30min and per-minute rates derived from $/hr."
    )
    ws.cell(row=1, column=1, value="Cost per Unit Time").font = WO_TAB_TITLE_FONT
    ws.cell(row=2, column=1, value=note).font = WO_NOTE_FONT
    ws.cell(
        row=3, column=1,
        value=f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
    ).font = WO_NOTE_FONT

    cols = [
        ("Vendor", 30, None),
        ("Total Est Cost", 16, FMT_CURRENCY),
        ("Total Hours", 12, FMT_HOURS),
        ("$/hour", 12, FMT_CURRENCY_DEC),
        ("$/30min", 12, FMT_CURRENCY_DEC),
        ("$/minute", 12, FMT_CURRENCY_DEC),
    ]
    _apply_widths(ws, cols)
    header_row = 4
    for c_idx, (label, _w, _f) in enumerate(cols, start=1):
        cell = ws.cell(row=header_row, column=c_idx, value=label)
        cell.font = WO_HEADER_FONT_BOLD
        cell.fill = WO_HEADER_FILL
        cell.border = THIN_BORDER

    vendor_names = sorted(
        {_vendor_name(vendors_by_id.get(w.assigned_vendor))
         for w in work_orders if w.assigned_vendor}
    )
    a, b = WO_HEADER_ROW + 1, flat_last_row
    for i, name in enumerate(vendor_names):
        r = header_row + 1 + i
        v_ref = f"A{r}"
        ws.cell(row=r, column=1, value=name).font = WO_BODY_FONT
        ws.cell(row=r, column=2,
                value=f'=SUMIF({flat}!B{a}:B{b},{v_ref},{flat}!M{a}:M{b})').number_format = FMT_CURRENCY
        ws.cell(row=r, column=3,
                value=f'=IFERROR(SUMIFS({flat}!AC{a}:AC{b},{flat}!B{a}:B{b},{v_ref},{flat}!AC{a}:AC{b},">0"),0)'
                ).number_format = FMT_HOURS
        ws.cell(row=r, column=4,
                value=f'=IFERROR(B{r}/C{r},0)').number_format = FMT_CURRENCY_DEC
        ws.cell(row=r, column=5,
                value=f'=D{r}/2').number_format = FMT_CURRENCY_DEC
        ws.cell(row=r, column=6,
                value=f'=D{r}/60').number_format = FMT_CURRENCY_DEC
        for c_idx in range(1, len(cols) + 1):
            ws.cell(row=r, column=c_idx).border = THIN_BORDER

    last_row = header_row + len(vendor_names)
    if vendor_names:
        ws.auto_filter.ref = f"A{header_row}:F{last_row}"
        ws.freeze_panes = ws[f"A{header_row + 1}"]
        _wo_data_bar(ws, "D", header_row + 1, last_row)
    ws.print_title_rows = f"1:{header_row}"
    _wo_set_print_area(ws, "F", max(last_row, header_row))


# ---------------------------------------------------------------------
# 8. Data Quality
# ---------------------------------------------------------------------

def _wo_write_data_quality(wb, work_orders, flat_last_row):
    ws = wb.create_sheet("Data Quality")
    note = (
        "Coverage and completeness of the source data driving the report."
    )
    ws.cell(row=1, column=1, value="Data Quality").font = WO_TAB_TITLE_FONT
    ws.cell(row=2, column=1, value=note).font = WO_NOTE_FONT
    ws.cell(
        row=3, column=1,
        value=f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
    ).font = WO_NOTE_FONT

    n = len(work_orders)
    miss_assigned = sum(1 for w in work_orders if not getattr(w, "assigned_at", None))
    miss_completed = sum(1 for w in work_orders if not getattr(w, "completed_at", None))
    miss_estimated_dates = sum(
        1 for w in work_orders
        if not getattr(w, "estimated_start_date", None) or not getattr(w, "estimated_end_date", None)
    )
    miss_cost = sum(1 for w in work_orders if not getattr(w, "estimated_cost", None))
    miss_vendor = sum(1 for w in work_orders if not w.assigned_vendor)

    seen = set()
    dup_codes = 0
    for w in work_orders:
        code = getattr(w, "work_order_code", None)
        if code is None:
            continue
        if code in seen:
            dup_codes += 1
        else:
            seen.add(code)

    rows = [
        ("Total work order rows", n, FMT_INT),
        ("Missing Assigned At", miss_assigned, FMT_INT),
        ("Missing Completed At", miss_completed, FMT_INT),
        ("Missing Estimated Start/End", miss_estimated_dates, FMT_INT),
        ("Missing Estimated Cost", miss_cost, FMT_INT),
        ("Missing Assigned Vendor", miss_vendor, FMT_INT),
        ("Duplicate work_order_code values", dup_codes, FMT_INT),
        ("% missing assigned timestamps", (miss_assigned / n) if n else 0, FMT_PCT),
        ("% missing completed timestamps", (miss_completed / n) if n else 0, FMT_PCT),
    ]
    for i, (label, val, fmt) in enumerate(rows):
        r = 5 + i
        ws.cell(row=r, column=1, value=label).font = WO_BODY_FONT
        cell = ws.cell(row=r, column=2, value=val)
        cell.number_format = fmt
        cell.font = WO_KPI_VALUE_FONT
    ws.column_dimensions["A"].width = 40
    ws.column_dimensions["B"].width = 16
    ws.print_title_rows = "1:4"
    _wo_set_print_area(ws, "B", 4 + len(rows))



# ---------------------------------------------------------------------------
# Vendors workbook
# ---------------------------------------------------------------------------


def build_vendors_workbook():
    wb = Workbook()
    wb.remove(wb.active)

    vendors = db.session.execute(
        select(Vendor).options(joinedload(Vendor.address))
    ).unique().scalars().all()

    _write_vendors_summary_sheet(wb, vendors)
    _write_vendors_directory_sheet(wb, vendors)
    _write_vendor_services_sheet(wb, vendors)
    return _to_workbook_bytes(wb)


def _write_vendors_summary_sheet(ws_wb, vendors):
    ws = ws_wb.create_sheet("Summary")
    _write_title(ws, "Vendor Directory Summary", f"{len(vendors)} vendor(s) on file.")

    by_status = defaultdict(int)
    by_compliance = defaultdict(int)
    onboarded = 0
    for v in vendors:
        by_status[_enum_value(getattr(v, "status", None)) or "UNKNOWN"] += 1
        by_compliance[_enum_value(getattr(v, "compliance_status", None)) or "UNKNOWN"] += 1
        if getattr(v, "onboarding", False):
            onboarded += 1

    row = 5
    ws.cell(row=row, column=1, value="HEADCOUNT").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    cols = [("Metric", 28, None), ("Count", 12, "#,##0")]
    _apply_widths(ws, cols)
    _write_header(ws, row, cols)
    for label, value in [
        ("Total vendors", len(vendors)),
        ("Onboarded vendors", onboarded),
    ]:
        row += 1
        _write_row(ws, row, cols, [label, value])

    row += 3
    ws.cell(row=row, column=1, value="BY STATUS").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    _write_header(ws, row, cols)
    for status, count in sorted(by_status.items(), key=lambda kv: kv[1], reverse=True):
        row += 1
        _write_row(ws, row, cols, [status, count], status_col=0)

    row += 3
    ws.cell(row=row, column=1, value="BY COMPLIANCE").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    _write_header(ws, row, cols)
    for compliance, count in sorted(by_compliance.items(), key=lambda kv: kv[1], reverse=True):
        row += 1
        _write_row(ws, row, cols, [compliance, count])


def _write_vendors_directory_sheet(ws_wb, vendors):
    ws = ws_wb.create_sheet("Vendors")
    _write_title(ws, "Vendor Directory", "All vendors with contact, status, and compliance details.")

    header_row = 5
    cols = [
        ("Company Name", 30, None),
        ("Vendor Code", 14, None),
        ("Status", 12, None),
        ("Compliance", 14, None),
        ("Onboarding", 12, None),
        ("Primary Contact", 24, None),
        ("Email", 28, None),
        ("Phone", 16, None),
        ("Address", 36, None),
        ("Description", 40, None),
        ("Start Date", 14, "yyyy-mm-dd"),
        ("End Date", 14, "yyyy-mm-dd"),
        ("Created", 18, "yyyy-mm-dd hh:mm"),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)

    sorted_vendors = sorted(vendors, key=_vendor_name)
    for i, v in enumerate(sorted_vendors, start=header_row + 1):
        addr_str = ""
        if v.address:
            parts = [
                v.address.street,
                v.address.city,
                v.address.state,
                v.address.zip,
            ]
            addr_str = ", ".join(p for p in parts if p)
        _write_row(
            ws,
            i,
            cols,
            [
                _vendor_name(v),
                v.vendor_code or "",
                _enum_value(getattr(v, "status", None)),
                _enum_value(getattr(v, "compliance_status", None)),
                "Yes" if getattr(v, "onboarding", False) else "No",
                v.primary_contact_name or "",
                v.company_email or "",
                v.company_phone or "",
                addr_str,
                v.description or "",
                _naive(getattr(v, "start_date", None)),
                _naive(getattr(v, "end_date", None)),
                _naive(v.created_at),
            ],
            status_col=2,
        )
    _finalize_data_sheet(ws, header_row, cols, len(sorted_vendors))


def _write_vendor_services_sheet(ws_wb, vendors):
    ws = ws_wb.create_sheet("Vendor Services")
    _write_title(ws, "Vendor Services", "One row per vendor-service link.")

    header_row = 5
    cols = [
        ("Vendor", 30, None),
        ("Service", 26, None),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)

    rows = []
    for v in vendors:
        services = getattr(v, "vendor_services", None) or []
        for vs in services:
            svc = getattr(vs, "service", None) or getattr(vs, "service_type", None)
            svc_name = getattr(svc, "service", None) if svc else None
            if svc_name:
                rows.append([_vendor_name(v), svc_name])
    rows.sort(key=lambda r: (r[0], r[1]))
    for i, row in enumerate(rows, start=header_row + 1):
        _write_row(ws, i, cols, row)
    _finalize_data_sheet(ws, header_row, cols, len(rows))


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------


def parse_date_range(from_str, to_str):
    """Parse 'YYYY-MM-DD' strings into (datetime, datetime) tuple. Returns
    (None, None) when both blank. The 'to' date becomes end-of-day so the
    full day is included.
    """
    start = None
    end = None
    if from_str:
        try:
            start = datetime.strptime(from_str, "%Y-%m-%d")
        except ValueError:
            start = None
    if to_str:
        try:
            d = datetime.strptime(to_str, "%Y-%m-%d")
            end = d.replace(hour=23, minute=59, second=59)
        except ValueError:
            end = None
    return start, end


def _in_range(value, start, end):
    if value is None:
        return False
    v = _naive(value)
    if start and v < start:
        return False
    if end and v > end:
        return False
    return True


def _period_label(start, end):
    if not start and not end:
        return "All time"
    if start and end:
        return f"{start.strftime('%Y-%m-%d')} to {end.strftime('%Y-%m-%d')}"
    if start:
        return f"From {start.strftime('%Y-%m-%d')}"
    return f"Through {end.strftime('%Y-%m-%d')}"


def _enum_value(value):
    if value is None:
        return None
    if hasattr(value, "value"):
        v = value.value
        return v.upper() if isinstance(v, str) else v
    return str(value)
