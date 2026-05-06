from app.extensions import ma
from marshmallow import fields, pre_load
from app.models import User

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

user_schema = UserSchema()
users_schema = UserSchema(many=True)


class LoginSchema(ma.Schema):
    identifier = fields.String(required=True)
    password = fields.String(required=True, load_only=True)

    @pre_load
    def strip_identifier(self, data, **kwargs):
        if 'identifier' in data:
            data['identifier'] = data['identifier'].strip()
        return data

login_schema = LoginSchema()