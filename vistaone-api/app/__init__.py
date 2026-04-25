from flask import Flask, app, jsonify
from app.extensions import ma, limiter, db
from app.blueprints.controller import users_bp
from app.blueprints.controller import profile_bp
from app.blueprints.controller import workorder_bp
from app.blueprints.controller import well_bp
from app.blueprints.controller import vendor_bp
from app.blueprints.controller import msa_bp
from app.blueprints.controller import invoice_bp
from app.blueprints.controller import clients_bp
from app.utils.logging_util import logging_setup
from flask_swagger_ui import get_swaggerui_blueprint
from dotenv import load_dotenv
from flask_cors import CORS
from app.extensions import mail

# Load .env file
load_dotenv()

SWAGGER_URL = "/api/docs"  # URL for exposing Swagger UI (without trailing '/')
API_URL = "/static/swagger.yaml"  # Our API URL (can of course be a local resource)

swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL, API_URL, config={"app_name": "Client Web Dashboard"}
)


def create_app(config_name="ProductionConfig"):
    app = Flask(__name__)
    app.config.from_object(f"config.{config_name}")

    app.url_map.strict_slashes = False

    # Initialize extensions
    ma.init_app(app)
    db.init_app(app)
    limiter.init_app(app)
    mail.init_app(app)

    logging_setup()
    _register_audit_hooks(db)

    # Register blueprints
    app.register_blueprint(users_bp, url_prefix="/users")
    app.register_blueprint(profile_bp, url_prefix="/users/profile")
    app.register_blueprint(workorder_bp, url_prefix="/workorders")
    app.register_blueprint(well_bp, url_prefix="/wells")
    app.register_blueprint(vendor_bp, url_prefix='/vendors')
    app.register_blueprint(msa_bp, url_prefix="/msa")
    app.register_blueprint(invoice_bp, url_prefix="/invoices")
    app.register_blueprint(clients_bp, url_prefix="/clients")
    app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

    CORS(
        app,
        origins=["http://localhost:5173"],
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    @app.errorhandler(429)
    def handle_rate_limit(_):
        return jsonify({"message": "Too many requests. Please try again later."}), 429

    @app.errorhandler(401)
    def unauthorized_error(e):
        return jsonify({"status": "error", "message": "Unauthorized access"}), 401

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"status": "error", "message": "Resource not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"status": "error", "message": "Internal server error"}), 500

    return app


_audit_hooks_registered = False


def _register_audit_hooks(db):
    """Auto-populate created_by / updated_by on every flush (idempotent)."""
    global _audit_hooks_registered
    if _audit_hooks_registered:
        return
    _audit_hooks_registered = True

    from sqlalchemy import event

    @event.listens_for(db.session, "before_flush")
    def _set_audit_fields(session, flush_context, instances):
        from flask import g, has_request_context
        from app.models.user import User

        actor_id = getattr(g, "current_user_id", None) if has_request_context() else None

        for obj in session.new:
            if not hasattr(obj, "created_by"):
                continue
            if obj.created_by is None:
                if actor_id:
                    obj.created_by = actor_id
                elif isinstance(obj, User):
                    # Self-registration: no JWT, use the new user's own generated ID
                    obj.created_by = obj.id
            if hasattr(obj, "updated_by") and obj.updated_by is None:
                obj.updated_by = actor_id or (obj.id if isinstance(obj, User) else None)

        for obj in session.dirty:
            if hasattr(obj, "updated_by") and actor_id:
                obj.updated_by = actor_id
