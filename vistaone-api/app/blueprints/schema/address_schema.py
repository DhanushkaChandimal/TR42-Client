from app.extensions import ma
from marshmallow import fields


class AddressSchema(ma.Schema):

    id = fields.String(dump_only=True)

    street = fields.String(required=True)
    city = fields.String(required=True)
    state = fields.String(required=True)
    zip = fields.String(required=True)
    country = fields.String(required=True)

    created_by = fields.String(dump_only=True)
    updated_by = fields.String(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
