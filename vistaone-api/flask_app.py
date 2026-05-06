import os
from dotenv import load_dotenv

# Load .env before importing the app so SECRET_KEY (and friends) are
# available when app.utils.util reads them at import time. Without this,
# `python flask_app.py` raises "SECRET_KEY environment variable is not set"
# even when .env exists, since plain python (unlike `flask run`) does not
# auto-load .env.
load_dotenv()

from app import create_app
from app.extensions import db

config_name = os.getenv("FLASK_CONFIG")
app = create_app(config_name)

# with app.app_context():
#     # db.drop_all()
#     db.create_all()

if __name__ == "__main__":
    app.run(debug=app.config.get("DEBUG", False))
