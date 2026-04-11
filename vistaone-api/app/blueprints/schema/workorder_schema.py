from app.extensions import ma
from marshmallow import fields, validates_schema, ValidationError
from app.models import WorkOrder
from app.blueprints.enum.enums import PriorityEnum, FrequencyEnum, LocationTypeEnum, StatusEnum
import logging

logger = logging.getLogger(__name__)

class WorkOrderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = WorkOrder
        include_fk = True
        load_instance = False

    client_id = fields.String(required=True)
    vendor_id = fields.String(required=True)
    service_type_id = fields.String(required=True)
    description = fields.String(required=True)

    location_type = fields.Enum(LocationTypeEnum, by_value=True, required=True)

    well_id = fields.String()
    latitude = fields.Float()
    longitude = fields.Float()
 
    address_id = fields.String()
    street = fields.String()
    city = fields.String()
    state = fields.String()
    zip = fields.String()

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
