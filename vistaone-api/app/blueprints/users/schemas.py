from app.extensions import ma
from app.models import User
from marshmallow import fields, pre_load

class UserSchema(ma.SQLAlchemyAutoSchema):
    email = fields.Email(required=True)
    password_hash = fields.String(load_only=True)
    password = fields.String(required=True, load_only=True)

    class Meta:
        model = User

    @pre_load
    def strip_email(self, data, **kwargs):
        if 'email' in data:
            data['email'] = data['email'].strip()
        return data
    
user_schema =UserSchema()
users_schema = UserSchema(many=True)
login_schema = UserSchema(only=['email', 'password'])
