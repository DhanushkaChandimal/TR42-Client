from flask import Flask, app, jsonify
from app.extensions import ma, limiter, db
from app.blueprints.controller import users_bp
from app.blueprints.controller import workorder_bp
from app.blueprints.controller import vendor_bp
from app.utils.logging_util import logging_setup
from flask_swagger_ui import get_swaggerui_blueprint
from dotenv import load_dotenv
from flask_cors import CORS


# Load .env file
load_dotenv()

SWAGGER_URL = '/api/docs'  # URL for exposing Swagger UI (without trailing '/')
API_URL = '/static/swagger.yaml'  # Our API URL (can of course be a local resource)

swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={
        'app_name': "Client Web Dashboard"
    }
)


def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(f'config.{config_name}')

    app.url_map.strict_slashes
    
    # Initialize extensions
    ma.init_app(app)
    db.init_app(app)
    limiter.init_app(app)

    logging_setup() 

    # Register blueprints
    app.register_blueprint(users_bp, url_prefix='/users')
    app.register_blueprint(workorder_bp, url_prefix='/workorders')
    app.register_blueprint(vendor_bp, url_prefix='/vendors')
    app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)
    
    CORS(
        app,
        origins = ["http://localhost:5173"],
        allow_headers = ["Content-Type", "Authorization"],
        methods =["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    @app.errorhandler(429)
    def handle_rate_limit(_):
        return jsonify({'message': 'Too many requests. Please try again later.'}), 429
    

    @app.errorhandler(401)
    def unauthorized_error(e):
        return jsonify({
        "status": "error",
        "message": "Unauthorized access"
    }), 401


    @app.errorhandler(404)
    def not_found(e):
        return jsonify({
        "status": "error",
        "message": "Resource not found"
    }), 404


    @app.errorhandler(500)
    def server_error(e):
        return jsonify({
        "status": "error",
        "message": "Internal server error"
    }), 500
    
    return app