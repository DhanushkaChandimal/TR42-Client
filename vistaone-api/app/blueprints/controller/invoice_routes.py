from flask import request, jsonify, Blueprint
from app.blueprints.schema.invoice_schema import invoice_schema, invoices_schema
from app.blueprints.services.invoice_service import InvoiceService
from app.blueprints.services.invoice_review_service import InvoiceReviewService
from marshmallow import ValidationError
from app.utils.util import permission_required, get_current_user_client_id
import logging

logger = logging.getLogger(__name__)

invoice_bp = Blueprint("invoice_bp", __name__)


@invoice_bp.route("/", methods=["POST"])
@permission_required("invoices", "write")
def create_invoice(current_user_id):
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400

    try:
        validated_data = invoice_schema.load(json_data)
        invoice = InvoiceService.create_invoice(validated_data, current_user_id)
        return invoice_schema.jsonify(invoice), 201
    except ValidationError as err:
        return jsonify(err.messages), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@invoice_bp.route("/", methods=["GET"])
@permission_required("invoices", "read")
def get_all_invoices(current_user_id):
    # Always scope to the caller's client. The client_id query param is ignored
    # so a CLIENT user cannot peek at another tenant's invoices by URL hacking.
    client_id = get_current_user_client_id()
    vendor_id = request.args.get("vendor_id")
    status = request.args.get("status")
    work_order_id = request.args.get("work_order_id")
    invoices = InvoiceService.get_all_invoices(
        vendor_id=vendor_id, client_id=client_id, status=status, work_order_id=work_order_id
    )
    return invoices_schema.jsonify(invoices), 200


@invoice_bp.route("/search", methods=["GET"])
@permission_required("invoices", "read")
def search_invoices(current_user_id):
    try:
        search_text = request.args.get("q", "")
        status = request.args.get("status") or None
        if status == "ALL":
            status = None
        work_order_id = request.args.get("work_order_id") or None
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
        sort_by = request.args.get("sort_by", "created_at")
        order = request.args.get("order", "desc")

        client_id = get_current_user_client_id()
        result = InvoiceService.search_invoices(
            search_text, status, page, per_page, sort_by, order,
            client_id=client_id, work_order_id=work_order_id,
        )
        return (
            jsonify({
                "total": result.total,
                "count": len(result.items),
                "page": result.page,
                "pages": result.pages,
                "data": invoices_schema.dump(result.items),
            }),
            200,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@invoice_bp.route("/summary", methods=["GET"])
@permission_required("invoices", "read")
def invoice_summary(current_user_id):
    """Whole-dataset status counts for the invoice list summary cards."""
    client_id = get_current_user_client_id()
    search_text = request.args.get("q", "")
    counts = InvoiceService.status_counts(client_id=client_id, search_text=search_text)
    return jsonify({"counts": counts}), 200


@invoice_bp.route("/<string:invoice_id>", methods=["GET"])
@permission_required("invoices", "read")
def get_invoice(current_user_id, invoice_id):
    try:
        client_id = get_current_user_client_id()
        invoice = InvoiceService.get_invoice(invoice_id, client_id=client_id)
        return invoice_schema.jsonify(invoice), 200
    except ValueError:
        return jsonify({"error": "Invoice not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@invoice_bp.route("/<string:invoice_id>", methods=["PUT"])
@permission_required("invoices", "write")
def update_invoice(current_user_id, invoice_id):
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400

    try:
        client_id = get_current_user_client_id()
        validated_data = invoice_schema.load(json_data, partial=True)
        invoice = InvoiceService.update_invoice(
            invoice_id, validated_data, current_user_id, client_id=client_id
        )
        return invoice_schema.jsonify(invoice), 200
    except ValidationError as err:
        return jsonify(err.messages), 400
    except ValueError:
        return jsonify({"error": "Invoice not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@invoice_bp.route("/<string:invoice_id>/approve", methods=["PUT"])
@permission_required("invoices", "write")
def approve_invoice(current_user_id, invoice_id):
    try:
        client_id = get_current_user_client_id()
        invoice = InvoiceService.approve_invoice(invoice_id, current_user_id, client_id=client_id)
        return invoice_schema.jsonify(invoice), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@invoice_bp.route("/<string:invoice_id>/reject", methods=["PUT"])
@permission_required("invoices", "write")
def reject_invoice(current_user_id, invoice_id):
    try:
        client_id = get_current_user_client_id()
        invoice = InvoiceService.reject_invoice(invoice_id, current_user_id, client_id=client_id)
        return invoice_schema.jsonify(invoice), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@invoice_bp.route("/<string:invoice_id>/set-pending", methods=["PUT"])
@permission_required("invoices", "write")
def set_pending_invoice(current_user_id, invoice_id):
    try:
        client_id = get_current_user_client_id()
        invoice = InvoiceService.set_pending_invoice(invoice_id, current_user_id, client_id=client_id)
        return invoice_schema.jsonify(invoice), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@invoice_bp.route("/<string:invoice_id>/review", methods=["POST"])
@permission_required("invoices", "read")
def review_invoice(current_user_id, invoice_id):
    """Run the AI-assisted invoice review against the vendor MSA pricing."""
    client_id = get_current_user_client_id()
    result, code = InvoiceReviewService.review_invoice(invoice_id, client_id)
    return jsonify(result), code
