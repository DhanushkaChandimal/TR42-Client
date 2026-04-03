from . import users_bp
from flask import request, jsonify
from marshmallow import ValidationError
from app.extensions import limiter
from app.blueprints.schema.auth_schema import login_schema
from app.blueprints.services.auth_service import LoginService
from app.utils.util import token_required

import logging

logger = logging.getLogger()

@users_bp.route("/login", methods=['POST'])
@limiter.limit("10 per minute")
def login():
    try:
        credentials = login_schema.load(request.json)

    except ValidationError as e:
        return jsonify(e.messages), 400

    email = credentials["email"]
    password = credentials["password"]

    print(f"Login attempt for email: {email}")
    logger.info(f"Login attempt for email: {email}")

    response, status_code = LoginService.login_user(email, password)

    return jsonify(response), status_code
    

@users_bp.route("/logout", methods=["POST"])
@token_required
def logout(user_id):
    
    response, status_code = LoginService.logout_user()
    logger.info(f"Logout response: {response}, Status Code: {status_code}")
    response = {
        "status": "success",
        "message": "Successfully logged out"
    }
    return jsonify(response), status_code