from flask import request, jsonify, Blueprint
from marshmallow import ValidationError
from app.blueprints.schema.register_client_schema import register_client_schema
from app.blueprints.services.auth_service import LoginService
import logging

clients_bp = Blueprint("clients_bp", __name__)
logger = logging.getLogger(__name__)


@clients_bp.route("/register", methods=["POST"])
def register_client():
    client_data = request.get_json()
    try:
        client_data = register_client_schema.load(client_data)
    except ValidationError as e:
        return jsonify(e.messages), 400
    result, status = LoginService.register_client(client_data)
    if status != 201:
        return jsonify(result), status
    client = result
    return jsonify({"message": "Client registered successfully", "client_id": client.id}), 201
