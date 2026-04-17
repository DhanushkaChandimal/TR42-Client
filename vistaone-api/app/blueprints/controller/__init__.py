from .auth_routes import users_bp
from .workorder_routes import workorder_bp
from .vendor_routes import vendor_bp


__all__ = [
    "users_bp",
    "workorder_bp",
    "vendor_bp",
    "well_bp"
]