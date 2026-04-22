from app.extensions import ma
from app.models.well import Well
from marshmallow_enum import EnumField
from app.blueprints.enum.enums import WellStatusEnum


class WellSchema(ma.SQLAlchemyAutoSchema):
    status = EnumField(WellStatusEnum, by_value=True)

    class Meta:
        model = Well
        load_instance = True
        include_fk = True


well_schema = WellSchema()
wells_schema = WellSchema(many=True)
