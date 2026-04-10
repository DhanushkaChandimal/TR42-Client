from app.extensions import ma
from marshmallow import fields, validates_schema, ValidationError
from app.models import WorkOrder
from app.models.enums import PriorityEnum, FrequencyEnum, LocationTypeEnum

class WorkOrderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = WorkOrder
        include_fk = True
        load_instance = False

    client_id = fields.String(required=True)
    vendor_id = fields.String(required=True)
    service_type_id = fields.String(required=True)
    description = fields.String(required=True)

    location_type = fields.String(required=True)

    well_number = fields.String()
    coordinates = fields.String()

    address_id = fields.String()
    street = fields.String()
    city = fields.String()
    state = fields.String()
    zip = fields.String()

    units = fields.String()
    estimated_quantity = fields.Float()

    priority = fields.String(required=True)

    is_recurring = fields.Boolean()

    recurrence_type = fields.String()

    estimated_start_date = fields.DateTime()
    estimated_end_date = fields.DateTime()


    @validates_schema
    def validate_location(self, data, **kwargs):
        # LOCATION VALIDATION
        location_type = data.get("location_type")

        if location_type == LocationTypeEnum.WELL.value:

            if not data.get("well_number"):
                raise ValidationError("well_number required for WELL location")

        elif location_type == LocationTypeEnum.GPS.value:

            if not data.get("coordinates"):
                raise ValidationError("coordinates required for GPS location")

        elif location_type == LocationTypeEnum.ADDRESS.value:

            if not data.get("address") and not data.get("street"):
                raise ValidationError("Either address or street required for ADDRESS location")


    @validates_schema
    def validate_fields(self, data, **kwargs):

        # ENUM validation
        if data.get("priority") not in [e.value for e in PriorityEnum]:
            raise ValidationError("Invalid priority")

        if data.get("recurrence_type") and data.get("recurrence_type") not in [e.value for e in FrequencyEnum]:
            raise ValidationError("Invalid recurrence_type")
        
        # RECURSION VALIDATION
        if data.get("is_recurring") == True and not data.get("recurrence_type"):
            raise ValidationError("recurrence_type required when is_recurring is TRUE")


workorder_schema = WorkOrderSchema()
workorders_schema = WorkOrderSchema(many=True)
