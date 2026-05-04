from datetime import datetime

from flask import Blueprint, request, send_file
import logging

from app.blueprints.services.export_service import (
    build_analytics_workbook,
    build_invoices_workbook,
    build_tickets_workbook,
    build_workorders_workbook,
    build_vendors_workbook,
    parse_date_range,
)
from app.utils.util import permission_required, token_required

logger = logging.getLogger(__name__)

export_bp = Blueprint("export", __name__)

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _today():
    return datetime.utcnow().strftime("%Y-%m-%d")


def _range():
    return parse_date_range(request.args.get("from"), request.args.get("to"))


@export_bp.route("/analytics.xlsx", methods=["GET"])
@token_required
def analytics_xlsx(user_id):
    start, end = _range()
    buf = build_analytics_workbook(start=start, end=end)
    return send_file(
        buf,
        mimetype=XLSX_MIME,
        as_attachment=True,
        download_name=f"analytics_{_today()}.xlsx",
    )


@export_bp.route("/invoices.xlsx", methods=["GET"])
@permission_required("invoices", "read")
def invoices_xlsx(user_id):
    start, end = _range()
    buf = build_invoices_workbook(start=start, end=end)
    return send_file(
        buf,
        mimetype=XLSX_MIME,
        as_attachment=True,
        download_name=f"invoices_{_today()}.xlsx",
    )


@export_bp.route("/tickets.xlsx", methods=["GET"])
@permission_required("workorders", "read")
def tickets_xlsx(user_id):
    start, end = _range()
    buf = build_tickets_workbook(start=start, end=end)
    return send_file(
        buf,
        mimetype=XLSX_MIME,
        as_attachment=True,
        download_name=f"tickets_{_today()}.xlsx",
    )


@export_bp.route("/workorders.xlsx", methods=["GET"])
@permission_required("workorders", "read")
def workorders_xlsx(user_id):
    start, end = _range()
    buf = build_workorders_workbook(start=start, end=end)
    return send_file(
        buf,
        mimetype=XLSX_MIME,
        as_attachment=True,
        download_name=f"workorders_{_today()}.xlsx",
    )


@export_bp.route("/vendors.xlsx", methods=["GET"])
@permission_required("vendors", "read")
def vendors_xlsx(user_id):
    buf = build_vendors_workbook()
    return send_file(
        buf,
        mimetype=XLSX_MIME,
        as_attachment=True,
        download_name=f"vendors_{_today()}.xlsx",
    )
