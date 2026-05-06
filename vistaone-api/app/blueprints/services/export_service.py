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

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
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


def build_workorders_workbook(start=None, end=None):
    wb = Workbook()
    wb.remove(wb.active)

    work_orders = db.session.execute(select(WorkOrder)).scalars().all()
    if start or end:
        work_orders = [
            w for w in work_orders if _in_range(w.created_at, start, end)
        ]
    vendors_by_id = {
        v.id: v for v in db.session.execute(select(Vendor)).scalars().all()
    }
    clients_by_id = {
        c.id: c for c in db.session.execute(select(Client)).scalars().all()
    }

    period = _period_label(start, end)
    _write_workorders_summary_sheet(wb, work_orders, vendors_by_id, clients_by_id, period)
    _write_workorders_by_vendor_sheet(wb, work_orders, vendors_by_id)
    _write_workorders_flat_sheet(wb, work_orders, vendors_by_id, clients_by_id)
    return _to_workbook_bytes(wb)


def _write_workorders_summary_sheet(ws_wb, work_orders, vendors_by_id, clients_by_id, period):
    ws = ws_wb.create_sheet("Summary")
    _write_title(ws, "Work Orders Summary", f"Period: {period}  ·  {len(work_orders)} work order(s)")

    by_status = defaultdict(int)
    by_priority = defaultdict(int)
    by_vendor = defaultdict(lambda: {"count": 0, "value": 0.0})
    by_location_type = defaultdict(int)
    by_client = defaultdict(int)
    total_cost = 0.0
    for w in work_orders:
        by_status[_enum_value(getattr(w, "current_status", None)) or "UNKNOWN"] += 1
        by_priority[_enum_value(getattr(w, "priority", None)) or "UNKNOWN"] += 1
        by_location_type[_enum_value(getattr(w, "location_type", None)) or "UNKNOWN"] += 1
        if w.client_id:
            by_client[w.client_id] += 1
        if w.assigned_vendor:
            by_vendor[w.assigned_vendor]["count"] += 1
            by_vendor[w.assigned_vendor]["value"] += float(getattr(w, "estimated_cost", 0) or 0)
        total_cost += float(getattr(w, "estimated_cost", 0) or 0)

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
    ws.cell(row=row, column=1, value="BY LOCATION TYPE").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    _write_header(ws, row, cols)
    for loc_type, count in sorted(by_location_type.items(), key=lambda kv: kv[1], reverse=True):
        row += 1
        _write_row(ws, row, cols, [loc_type, count])

    row += 3
    ws.cell(row=row, column=1, value="BY CLIENT").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    ccols = [("Client", 30, None), ("WO Count", 12, "#,##0")]
    _apply_widths(ws, ccols)
    _write_header(ws, row, ccols)
    for cid, count in sorted(by_client.items(), key=lambda kv: kv[1], reverse=True):
        c = clients_by_id.get(cid)
        client_name = (getattr(c, "client_name", None) or cid[:8]) if c else (cid[:8] if cid else "Unknown")
        row += 1
        _write_row(ws, row, ccols, [client_name, count])

    row += 3
    ws.cell(row=row, column=1, value="BY VENDOR").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    vcols = [("Vendor", 30, None), ("WO Count", 12, "#,##0"), ("Est Total", 18, "$#,##0.00")]
    _apply_widths(ws, vcols)
    _write_header(ws, row, vcols)
    for vid, slot in sorted(by_vendor.items(), key=lambda kv: kv[1]["count"], reverse=True):
        v = vendors_by_id.get(vid)
        row += 1
        _write_row(ws, row, vcols, [_vendor_name(v), slot["count"], slot["value"]])

    row += 3
    ws.cell(row=row, column=1, value="TOTALS").font = SUBHEADER_FONT
    ws.cell(row=row, column=1).fill = SUBHEADER_FILL
    row += 1
    tcols = [("Metric", 30, None), ("Value", 18, None)]
    _apply_widths(ws, tcols)
    _write_header(ws, row, tcols)
    row += 1
    _write_row(ws, row, tcols, ["Total work orders", len(work_orders)])
    row += 1
    _write_row(ws, row, [("Metric", 30, None), ("Value", 18, "$#,##0.00")], ["Total estimated cost", total_cost])


def _write_workorders_by_vendor_sheet(ws_wb, work_orders, vendors_by_id):
    ws = ws_wb.create_sheet("By Vendor")
    _write_title(ws, "Work Orders by Vendor", "Grouped per vendor with a count subtotal.")

    cols = [
        ("WO #", 10, "#,##0"),
        ("Description", 40, None),
        ("Status", 16, None),
        ("Priority", 12, None),
        ("Service", 18, None),
        ("Location", 22, None),
        ("Est Cost", 14, "$#,##0.00"),
        ("Estimated Start", 16, "yyyy-mm-dd"),
        ("Estimated End", 16, "yyyy-mm-dd"),
        ("Created", 14, "yyyy-mm-dd"),
    ]
    _apply_widths(ws, cols)

    by_vendor = defaultdict(list)
    for w in work_orders:
        by_vendor[w.assigned_vendor or "unknown"].append(w)

    row = 5
    for vid in sorted(by_vendor.keys(), key=lambda x: _vendor_name(vendors_by_id.get(x))):
        v = vendors_by_id.get(vid)
        wos = sorted(by_vendor[vid], key=lambda w: w.created_at or datetime.min, reverse=True)

        banner = ws.cell(row=row, column=1, value=_vendor_name(v))
        banner.font = Font(bold=True, color="FFFFFF", size=12)
        banner.fill = HEADER_FILL
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(cols))
        row += 1

        _write_header(ws, row, cols)
        row += 1

        for w in wos:
            service = (w.service.service if getattr(w, "service", None) else None)
            location_str = getattr(w, "location", None) or (
                f"{w.latitude}, {w.longitude}"
                if getattr(w, "latitude", None) is not None and getattr(w, "longitude", None) is not None
                else ""
            )
            _write_row(
                ws,
                row,
                cols,
                [
                    getattr(w, "work_order_code", None),
                    w.description or "",
                    _enum_value(getattr(w, "current_status", None)),
                    _enum_value(getattr(w, "priority", None)),
                    service or "",
                    location_str,
                    float(getattr(w, "estimated_cost", 0) or 0),
                    _naive(getattr(w, "estimated_start_date", None)),
                    _naive(getattr(w, "estimated_end_date", None)),
                    _naive(w.created_at),
                ],
                status_col=2,
            )
            row += 1

        sub = ws.cell(row=row, column=1, value=f"Vendor subtotal: {len(wos)} work order(s)")
        sub.font = SUBHEADER_FONT
        sub.fill = SUBHEADER_FILL
        sub.border = THIN_BORDER
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(cols))
        row += 2

    ws.freeze_panes = ws["A5"]


def _write_workorders_flat_sheet(ws_wb, work_orders, vendors_by_id, clients_by_id):
    ws = ws_wb.create_sheet("All Work Orders (flat)")
    _write_title(ws, "All Work Orders", "Sortable, filterable list.")

    header_row = 5
    cols = [
        ("Client", 28, None),
        ("Vendor", 30, None),
        ("WO #", 10, "#,##0"),
        ("Description", 40, None),
        ("Status", 16, None),
        ("Priority", 12, None),
        ("Service", 18, None),
        ("Location Type", 14, None),
        ("Location", 28, None),
        ("Latitude", 12, "#,##0.000000"),
        ("Longitude", 12, "#,##0.000000"),
        ("Well ID", 36, None),
        ("Est Cost", 14, "$#,##0.00"),
        ("Est Quantity", 14, "#,##0.00"),
        ("Units", 10, None),
        ("Recurring?", 10, None),
        ("Recurrence", 12, None),
        ("Estimated Start", 16, "yyyy-mm-dd"),
        ("Estimated End", 16, "yyyy-mm-dd"),
        ("Assigned At", 18, "yyyy-mm-dd hh:mm"),
        ("Completed At", 18, "yyyy-mm-dd hh:mm"),
        ("Closed At", 18, "yyyy-mm-dd hh:mm"),
        ("Halted At", 18, "yyyy-mm-dd hh:mm"),
        ("Rejected At", 18, "yyyy-mm-dd hh:mm"),
        ("Created", 18, "yyyy-mm-dd hh:mm"),
        ("Updated", 18, "yyyy-mm-dd hh:mm"),
        ("Cancelled At", 18, "yyyy-mm-dd hh:mm"),
        ("Cancellation Reason", 32, None),
    ]
    _apply_widths(ws, cols)
    _write_header(ws, header_row, cols)

    sorted_wos = sorted(
        work_orders,
        key=lambda w: (
            _vendor_name(vendors_by_id.get(w.assigned_vendor)),
            -(w.created_at.timestamp() if w.created_at else 0),
        ),
    )
    for i, w in enumerate(sorted_wos, start=header_row + 1):
        v = vendors_by_id.get(w.assigned_vendor)
        c = clients_by_id.get(w.client_id) if w.client_id else None
        client_name = getattr(c, "client_name", None) if c else None
        service = (w.service.service if getattr(w, "service", None) else None)
        location_str = getattr(w, "location", None) or (
            f"{w.latitude}, {w.longitude}"
            if getattr(w, "latitude", None) is not None and getattr(w, "longitude", None) is not None
            else ""
        )
        lat = getattr(w, "latitude", None)
        lng = getattr(w, "longitude", None)
        _write_row(
            ws,
            i,
            cols,
            [
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
            ],
            status_col=4,
        )
    _finalize_data_sheet(ws, header_row, cols, len(sorted_wos))


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
