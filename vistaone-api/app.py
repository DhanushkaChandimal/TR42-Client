from app import create_app
from app.extensions import db

app = create_app('ProductionConfig')

# with app.app_context():
#      #db.drop_all()
#     db.create_all()

app.run(debug=True)