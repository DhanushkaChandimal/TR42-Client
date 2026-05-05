from app.extensions import ma
from app.models.well import Well
from app.models.well_location import WellLocation
from marshmallow import fields
from marshmallow_enum import EnumField
from app.blueprints.enum.enums import WellStatusEnum, WellTypeEnum


class WellLocationSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = WellLocation
        load_instance = True
        include_fk = True
        exclude = ("created_at", "updated_at", "created_by", "updated_by", "well_id", "id")


class WellSchema(ma.SQLAlchemyAutoSchema):
    status = EnumField(WellStatusEnum, by_value=True)
    type = EnumField(WellTypeEnum, by_value=True)
    client_id = ma.auto_field(dump_only=True)
    location = fields.Nested(WellLocationSchema, allow_none=True)

    class Meta:
        model = Well
        load_instance = True
        include_fk = True


well_schema = WellSchema()
wells_schema = WellSchema(many=True)
