from flask import request, jsonify, Blueprint
from marshmallow import ValidationError
from app.extensions import limiter
from app.blueprints.schema.auth_schema import login_schema
from app.blueprints.services.auth_service import LoginService
from app.utils.util import token_required
import logging


users_bp = Blueprint("users_bp", __name__, url_prefix="/auth")


logger = logging.getLogger(__name__)

# Endpoint to verify JWT token validity
@users_bp.route("/verify-token", methods=["GET"])
@token_required
def verify_token(user_id):
    logger.info(f"Token verification requested for user ID")
    return jsonify({"message": "Token is valid!", "user_id": user_id}), 200

@users_bp.route("/login", methods=['POST'])
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
    

@users_bp.route("/logout", methods=["POST"])
@token_required
def logout(user_id):
    logger.info(f"Logout request received for user ID: {user_id}")
    response, status_code = LoginService.logout_user()
    logger.info(f"Logout response: {response}, Status Code: {status_code}")
    response = {
        "status": "success",
        "message": "Successfully logged out"
    }
    return jsonify(response), status_code