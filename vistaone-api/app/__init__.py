from flask import Flask, jsonify
from .extensions import ma, limiter
from app.models import db
from app.blueprints.controller import users_bp
from flask_swagger_ui import get_swaggerui_blueprint
from app.utils.loggingUtil import logging_setup

from dotenv import load_dotenv


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
    
    # Initialize extensions
    ma.init_app(app)
    db.init_app(app)
    limiter.init_app(app)

    logging_setup()
    
    # Register blueprints
    app.register_blueprint(users_bp, url_prefix='/users')
    app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

    @app.errorhandler(429)
    def handle_rate_limit(_):
        return jsonify({'message': 'Too many requests. Please try again later.'}), 429
    

   
    
    return app
