from flask import request, jsonify, Blueprint
from marshmallow import ValidationError
from app.extensions import limiter
from app.blueprints.schema.auth_schema import login_schema
from app.blueprints.schema.register_user_schema import register_user_schema
from app.blueprints.services.auth_service import LoginService
from app.models.user import User
from app.utils.util import token_required
import logging

users_bp = Blueprint("users_bp", __name__)
logger = logging.getLogger(__name__)


# Endpoint to verify JWT token validity
@users_bp.route("/verify-token", methods=["GET"])
@token_required
def verify_token(user_id):
    logger.info(f"Token verification requested for user ID")
    return jsonify({"message": "Token is valid!", "user_id": user_id}), 200


@users_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    try:
        credentials = login_schema.load(request.json)

    except ValidationError as e:
        return jsonify(e.messages), 400

    email = credentials["email"]
    password = credentials["password"]

    logger.info(f"Login attempt for email")

    response, status_code = LoginService.login_user(email, password)

    return jsonify(response), status_code


# GET current user profile including company_id
@users_bp.route("/me", methods=["GET"])
@token_required
def get_current_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return (
        jsonify(
            {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "company_id": user.client_id,
                "roles": [r.name for r in user.roles],
            }
        ),
        200,
    )


@users_bp.route("/logout", methods=["POST"])
@token_required
def logout(user_id):
    logger.info(f"Logout request received for user ID:")
    response, status_code = LoginService.logout_user(user_id)
    logger.info(f"Logout response: {response}, Status Code: {status_code}")
    response = {"status": "success", "message": "Successfully logged out"}
    return jsonify(response), status_code


@users_bp.route("/register", methods=["POST"])
def register_user():
    user_data = request.get_json()
    try:
        user_data = register_user_schema.load(user_data)
    except ValidationError as e:
        return jsonify(e.messages), 400
    result, status = LoginService.register_user(user_data)
    if status != 201:
        return jsonify(result), status
    user = result
    return jsonify({"message": "User registered successfully", "user_id": user.id}), 201


@users_bp.route("/verify-email", methods=["GET"])
def verify_email():
    token = request.args.get("token")
    result, status = LoginService.verify_email(token)
    return jsonify(result), status
