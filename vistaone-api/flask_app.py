import os
from dotenv import load_dotenv

# load_dotenv()  # Not needed for deployment on Render

from app import create_app
from app.extensions import db

config_name = os.getenv("FLASK_CONFIG")
app = create_app(config_name)

# The following block is not needed for deployment on Render
# if __name__ == "__main__":
#     app.run(debug=app.config.get("DEBUG", False))
