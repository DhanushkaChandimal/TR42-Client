from . import users_bp
from flask import request, jsonify
from marshmallow import ValidationError
from sqlalchemy import select
from app.models import db, User
from app.extensions import limiter
from app.utils.util import encode_token
from .schemas import login_schema
import logging

logger = logging.getLogger(__name__)

@users_bp.route("/login", methods=['POST'])
@limiter.limit("10 per minute")
def login():
    logger.info("Login attempt received")
    try:
        credentials = login_schema.load(request.json)
        email = credentials['email']
        password = credentials['password']
    except ValidationError as e:
        return jsonify(e.messages), 400

    query = select(User).where(User.email == email)
    user = db.session.execute(query).scalars().first()

    if user and user.check_password(password):
        logger.info("User logged in successfully")
        token = encode_token(user.id)

        response = {
            "status": "success",
            "message": "Successfully Logged In",
            "token": token
        }
        
        return jsonify(response), 200
    else:
        logger.error(f"Failed login attempt for email: {email}")
        return jsonify({'message': "Invalid email or password"}), 401