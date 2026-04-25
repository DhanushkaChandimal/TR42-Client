from flask import request, jsonify, Blueprint
from app.blueprints.schema.ticket_schema import ticket_schema, tickets_schema
from app.blueprints.services.ticket_service import TicketService
from marshmallow import ValidationError
from app.utils.util import token_required
import logging

logger = logging.getLogger(__name__)

ticket_bp = Blueprint("ticket_bp", __name__)


@ticket_bp.route("/", methods=["GET"])
@token_required
def get_all_tickets(current_user_id):
    work_order_id = request.args.get("work_order_id")
    vendor_id = request.args.get("vendor_id")
    status = request.args.get("status")
    tickets = TicketService.get_all_tickets(
        work_order_id=work_order_id, vendor_id=vendor_id, status=status
    )
    return tickets_schema.jsonify(tickets), 200


@ticket_bp.route("/<string:ticket_id>", methods=["GET"])
@token_required
def get_ticket(current_user_id, ticket_id):
    try:
        ticket = TicketService.get_ticket(ticket_id)
        return ticket_schema.jsonify(ticket), 200
    except ValueError:
        return jsonify({"error": "Ticket not found"}), 404


@ticket_bp.route("/", methods=["POST"])
@token_required
def create_ticket(current_user_id):
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400
    try:
        validated_data = ticket_schema.load(json_data)
        ticket = TicketService.create_ticket(validated_data, current_user_id)
        return ticket_schema.jsonify(ticket), 201
    except ValidationError as err:
        return jsonify(err.messages), 400
    except Exception as e:
        logger.error(f"Error creating ticket: {e}")
        return jsonify({"error": str(e)}), 400


@ticket_bp.route("/<string:ticket_id>", methods=["PUT"])
@token_required
def update_ticket(current_user_id, ticket_id):
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "No input data provided"}), 400
    try:
        validated_data = ticket_schema.load(json_data, partial=True)
        ticket = TicketService.update_ticket(
            ticket_id, validated_data, current_user_id
        )
        return ticket_schema.jsonify(ticket), 200
    except ValidationError as err:
        return jsonify(err.messages), 400
    except ValueError:
        return jsonify({"error": "Ticket not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400
