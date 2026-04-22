from flask import request, jsonify, Blueprint
from app.blueprints.schema.invoice_schema import invoice_schema, invoices_schema
from app.blueprints.services.invoice_service import InvoiceService
from marshmallow import ValidationError
from app.utils.util import token_required
import logging

logger = logging.getLogger(__name__)

invoice_bp = Blueprint("invoice_bp", __name__)


# CREATE Invoice
@invoice_bp.route("/", methods=["POST"])
@token_required
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


# GET all invoices
@invoice_bp.route("/", methods=["GET"])
@token_required
def get_all_invoices(current_user_id):
    vendor_id = request.args.get("vendor_id")
    client_id = request.args.get("client_id")
    status = request.args.get("status")
    invoices = InvoiceService.get_all_invoices(
        vendor_id=vendor_id, client_id=client_id, status=status
    )
    return invoices_schema.jsonify(invoices), 200


# GET invoice by ID
@invoice_bp.route("/<string:invoice_id>", methods=["GET"])
@token_required
def get_invoice(current_user_id, invoice_id):
    try:
        invoice = InvoiceService.get_invoice(invoice_id)
        return invoice_schema.jsonify(invoice), 200
    except ValueError:
        return jsonify({"error": "Invoice not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# UPDATE invoice
@invoice_bp.route("/<string:invoice_id>", methods=["PUT"])
@token_required
def update_invoice(current_user_id, invoice_id):
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400

    try:
        validated_data = invoice_schema.load(json_data, partial=True)
        invoice = InvoiceService.update_invoice(
            invoice_id, validated_data, current_user_id
        )
        return invoice_schema.jsonify(invoice), 200
    except ValidationError as err:
        return jsonify(err.messages), 400
    except ValueError:
        return jsonify({"error": "Invoice not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# APPROVE invoice
@invoice_bp.route("/<string:invoice_id>/approve", methods=["PUT"])
@token_required
def approve_invoice(current_user_id, invoice_id):
    try:
        invoice = InvoiceService.approve_invoice(invoice_id, current_user_id)
        return invoice_schema.jsonify(invoice), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# REJECT invoice
@invoice_bp.route("/<string:invoice_id>/reject", methods=["PUT"])
@token_required
def reject_invoice(current_user_id, invoice_id):
    try:
        invoice = InvoiceService.reject_invoice(invoice_id, current_user_id)
        return invoice_schema.jsonify(invoice), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400
