from app.extensions import ma
from marshmallow import fields
from app.blueprints.schema.address_schema import AddressSchema


class RegisterUserSchema(ma.Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)
    username = fields.String(required=True)
    first_name = fields.String(required=True)
    middle_name = fields.String()
    last_name = fields.String(required=True)
    date_of_birth = fields.Date()
    ssn_last_four = fields.String()
    contact_number = fields.String(required=True)
    alternate_number = fields.String()
    client_id = fields.String(required=True)

    address = fields.Nested(AddressSchema, required=True)


register_user_schema = RegisterUserSchema()
