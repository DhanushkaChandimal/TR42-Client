import os
from dotenv import load_dotenv
from app import create_app
from app.extensions import db

load_dotenv()

config_name = os.getenv("FLASK_CONFIG")
app = create_app(config_name)

if __name__ == "__main__":
    app.run(debug=app.config.get("DEBUG", False))
