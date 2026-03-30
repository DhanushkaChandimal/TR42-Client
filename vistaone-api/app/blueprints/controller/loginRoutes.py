from . import users_bp
from flask import request, jsonify
from marshmallow import ValidationError
from sqlalchemy import select
from app.models import db, User
from app.extensions import limiter
from app.utils.util import encode_token
from app.blueprints.schema.userSchema import login_schema
from app.blueprints.services.loginService import LoginService

@users_bp.route("/login", methods=['POST'])
@limiter.limit("10 per minute")
def login():
    try:
        credentials = login_schema.load(request.json)

    except ValidationError as e:
        return jsonify(e.messages), 400

    email = credentials["email"]
    password = credentials["password"]

    response, status_code = LoginService.login_user(email, password)

    return jsonify(response), status_code
    

    