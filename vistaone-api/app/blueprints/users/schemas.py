from app.extensions import ma
from app.models import User
from marshmallow import fields

class UserSchema(ma.SQLAlchemyAutoSchema):
    email = fields.Email(required=True)
    password_hash = fields.String(load_only=True)
    password = fields.String(required=True, load_only=True)

    class Meta:
        model = User
    
user_schema =UserSchema()
users_schema = UserSchema(many=True)
login_schema = UserSchema(only=['email', 'password'])
