from flask import request, jsonify, Blueprint
from marshmallow import ValidationError
from app.blueprints.schema.register_client_schema import register_client_schema
from app.blueprints.services.auth_service import LoginService
from app.utils.util import role_required
from app.models.user import User
from app.extensions import db, limiter
import logging

clients_bp = Blueprint("clients_bp", __name__)
logger = logging.getLogger(__name__)

MASTER = "MASTER"


@clients_bp.route("", methods=["GET"])
@limiter.limit("30 per minute")
def list_clients():
    """Public endpoint — returns minimal client info for the registration dropdown."""
    from app.blueprints.repository.client_repository import ClientRepository
    clients = ClientRepository.get_all_clients()
    return jsonify([
        {"id": c.id, "client_name": c.client_name, "client_code": c.client_code, "company_web_address": c.company_web_address}
        for c in clients
    ]), 200


@clients_bp.route("/register", methods=["POST"])
def register_client():
    client_data = request.get_json()
    try:
        client_data = register_client_schema.load(client_data)
    except ValidationError as e:
        return jsonify(e.messages), 400
    try:
        result, status = LoginService.register_client(client_data)
    except Exception:
        logger.error("Unhandled error in register_client", exc_info=True)
        return jsonify({"message": "An error occurred during registration. Please try again."}), 500
    if status != 201:
        return jsonify(result), status
    client = result["data"]
    if result["email_sent"]:
        message = "Client registered successfully. Please check your email to verify your account."
    else:
        message = "Client registered successfully. We were unable to send a verification email. Please contact your administrator."
    return jsonify({"message": message, "client_id": client.id}), 201


@clients_bp.route("/settings", methods=["GET"])
@role_required(MASTER)
def get_settings(user_id):
    user = User.query.get(user_id)
    client = user.client
    return jsonify({
        "client_id": client.id,
        "client_name": client.client_name,
        "approved_domain": client.approved_domain,
    }), 200


@clients_bp.route("/settings", methods=["PUT"])
@role_required(MASTER)
def update_settings(user_id):
    user = User.query.get(user_id)
    client = user.client
    data = request.get_json() or {}

    if "approved_domain" in data:
        domain = data["approved_domain"]
        if domain is not None:
            domain = domain.strip() or None
        client.approved_domain = domain

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify({
        "message": "Settings updated",
        "approved_domain": client.approved_domain,
    }), 200
