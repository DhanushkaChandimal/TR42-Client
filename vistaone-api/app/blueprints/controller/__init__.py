from .auth_routes import users_bp
from .user_profile_routes import profile_bp
from .workorder_routes import workorder_bp
from .vendor_routes import vendor_bp
from .well_routes import well_bp
from .msa_routes import msa_bp
from .invoice_routes import invoice_bp
from .client_routes import clients_bp
from .ticket_routes import ticket_bp


__all__ = [
    "users_bp",
    "profile_bp",
    "workorder_bp",
    "vendor_bp",
    "well_bp",
    "msa_bp",
    "invoice_bp",
    "clients_bp",
    "ticket_bp",
]
