from flask import Blueprint

users_bp = Blueprint("users_bp", __name__)

#workorder_bp = Blueprint("workorder", __name__)

from . import auth_routes