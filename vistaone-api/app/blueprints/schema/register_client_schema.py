from app.extensions import ma
from marshmallow import fields
from app.blueprints.schema.address_schema import AddressSchema


class AdminUserSchema(ma.Schema):
    username = fields.String(required=True)
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)
    first_name = fields.String(required=True)
    last_name = fields.String(required=True)
    contact_number = fields.String(required=True)


class RegisterClientSchema(ma.Schema):
    client_name = fields.String(required=True)
    client_code = fields.String(required=True)
    primary_contact_name = fields.String(required=True)
    company_email = fields.Email(required=True)
    company_phone = fields.String(required=True)
    company_web_address = fields.String(load_default=None)
    address = fields.Nested(AddressSchema, required=True)
    admin_user = fields.Nested(AdminUserSchema, required=True)


register_client_schema = RegisterClientSchema()
