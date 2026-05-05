from app.extensions import ma
from marshmallow import fields, EXCLUDE
from app.models.user import User
from app.blueprints.schema.address_schema import AddressSchema


class UserProfileSchema(ma.SQLAlchemySchema):
    class Meta:
        model = User
        load_instance = False
        unknown = EXCLUDE

    id = ma.auto_field(dump_only=True)

    username = ma.auto_field(dump_only=True)
    email = ma.auto_field(dump_only=True)

    first_name = ma.auto_field()
    middle_name = ma.auto_field()
    last_name = ma.auto_field()
    contact_number = ma.auto_field()
    alternate_number = ma.auto_field()

    profile_photo = ma.auto_field()
    date_of_birth = ma.auto_field()

    address = fields.Nested(AddressSchema)

    client_name = fields.Method("get_client_name", dump_only=True)

    def get_client_name(self, obj):
        return obj.client.client_name if getattr(obj, "client", None) else None


user_profile_schema = UserProfileSchema()
