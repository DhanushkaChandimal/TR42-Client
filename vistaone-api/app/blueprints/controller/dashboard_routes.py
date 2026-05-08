"""Dashboard summary endpoint.

Pushes the aggregations the dashboard widgets need (counts, totals) to the
database so the frontend can render with a single small payload instead of
fetching every row and grouping in JavaScript.
"""
from flask import Blueprint, jsonify
from sqlalchemy import func, select

from app.extensions import db
from app.models.workorder import WorkOrder
from app.models.invoice import Invoice
from app.models.well import Well
from app.blueprints.enum.enums import InvoiceStatusEnum
from app.utils.util import permission_required, get_current_user_client_id


dashboard_bp = Blueprint("dashboard_bp", __name__)


OUTSTANDING_INVOICE_STATUSES = (
    InvoiceStatusEnum.SUBMITTED,
    InvoiceStatusEnum.APPROVED,
)


@dashboard_bp.route("/summary", methods=["GET"])
@permission_required("dashboard", "read")
def dashboard_summary(current_user_id):
    client_id = get_current_user_client_id()

    # Work orders: total + by_status
    wo_status_rows = db.session.execute(
        select(WorkOrder.current_status, func.count(WorkOrder.id))
        .where(WorkOrder.client_id == client_id)
        .group_by(WorkOrder.current_status)
    ).all()
    wo_by_status = {
        (status.value if status is not None else "UNKNOWN"): int(count)
        for status, count in wo_status_rows
    }
    wo_total = sum(wo_by_status.values())

    # Invoices: outstanding total + count
    inv_row = db.session.execute(
        select(func.count(Invoice.id), func.coalesce(func.sum(Invoice.total_amount), 0))
        .where(Invoice.client_id == client_id)
        .where(Invoice.invoice_status.in_(OUTSTANDING_INVOICE_STATUSES))
    ).first()
    outstanding_count = int(inv_row[0] or 0)
    outstanding_total = float(inv_row[1] or 0)

    # Wells: total
    wells_total = int(
        db.session.execute(
            select(func.count(Well.id)).where(Well.client_id == client_id)
        ).scalar()
        or 0
    )

    return (
        jsonify({
            "work_orders": {
                "total": wo_total,
                "by_status": wo_by_status,
            },
            "invoices": {
                "outstanding_count": outstanding_count,
                "outstanding_total": outstanding_total,
            },
            "wells": {
                "total": wells_total,
            },
        }),
        200,
    )
