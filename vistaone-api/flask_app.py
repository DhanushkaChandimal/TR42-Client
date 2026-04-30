import os
from app import create_app
from app.extensions import db

config_name = os.getenv("FLASK_CONFIG")
app = create_app(config_name)

with app.app_context():
    # db.drop_all()
    db.create_all()

if __name__ == "__main__":
    app.run(debug=app.config.get("DEBUG", False))
