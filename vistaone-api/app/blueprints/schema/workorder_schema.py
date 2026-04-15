from app.extensions import ma
from marshmallow import EXCLUDE, fields, validates_schema, ValidationError
from app.models import WorkOrder
from app.blueprints.schema.vendor_schema import VendorSchema
from app.blueprints.schema.service_type_schema import ServiceTypeSchema
from app.blueprints.enum.enums import (
    PriorityEnum,
    FrequencyEnum,
    LocationTypeEnum,
    StatusEnum,
)
from app.blueprints.schema.address_schema import AddressSchema
import logging

logger = logging.getLogger(__name__)


class WorkOrderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = WorkOrder
        include_fk = True
        load_instance = False
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    work_order_id = fields.String(dump_only=True)

    client_id = fields.String(required=True)
    vendor_id = fields.String(required=True)
    service_type_id = fields.String(required=True)
    description = fields.String(required=True)

    location_type = fields.Enum(LocationTypeEnum, by_value=True, required=True)

    well_id = fields.String()
    latitude = fields.Float()
    longitude = fields.Float()

    address_id = (
        fields.String()
    )  # WorkOrderSchema will accept address fields but they will be used to create an Address record and linked via address_id. address_id is optional in input because if location_type is GPS or WELL, we won't have address info. But if location_type is ADDRESS, we will create an Address record and link it via address_id.
    address = fields.Nested(
        "AddressSchema", dump_only=True
    )  # Nested schema for output only. When we return a workorder, we want to include the address details if it's an ADDRESS type.
    street = (
        fields.String()
    )  # These fields are for input only. They will be used to create an Address record if location_type is ADDRESS, but they won't be stored directly in the WorkOrder table.
    city = fields.String()
    state = fields.String()
    zip = fields.String()
    country = fields.String()

    units = fields.String()
    estimated_quantity = fields.Float()

    priority = fields.Enum(PriorityEnum, by_value=True, required=True)

    is_recurring = fields.Boolean()
    recurrence_type = fields.Enum(FrequencyEnum, by_value=True)

    estimated_start_date = fields.DateTime()
    estimated_end_date = fields.DateTime()

    status = fields.Enum(StatusEnum, by_value=True)

    @validates_schema
    def validate_fields(self, data, **kwargs):
        # RECURSION VALIDATION
        if data.get("is_recurring") == True and not data.get("recurrence_type"):
            raise ValidationError("recurrence_type required when is_recurring is TRUE")


workorder_schema = WorkOrderSchema()
workorders_schema = WorkOrderSchema(many=True)
