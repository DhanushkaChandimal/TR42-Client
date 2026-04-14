from app.extensions import ma
from marshmallow import fields
from app.models import Address


class AddressSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Address
        load_instance = False
        include_fk = True

    address_id = fields.String(dump_only=True)

    street = fields.String()
    city = fields.String()
    state = fields.String()
    zip = fields.String()
    country = fields.String()

    created_by = fields.String(dump_only=True)
    created_date = fields.DateTime(load_only=True)

    last_modified_by = fields.String(load_only=True)
    last_modified_date = fields.DateTime(load_only=True)


address_schema = AddressSchema()
addresses_schema = AddressSchema(many=True)