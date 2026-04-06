from app.extensions import ma
from marshmallow import fields, validates_schema, ValidationError
from app.models.workorder import WorkOrder
from app.models.enums import PriorityEnum, FrequencyEnum, LocationTypeEnum

class WorkOrderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = WorkOrder
       # include_fk = True
        load_instance = True

    client_id = fields.String(required=True)
    vendor_id = fields.String(required=True)
    service_type_id = fields.String(required=True)
    description = fields.String(required=True)

    location_type = fields.String(required=True)

    well_number = fields.String()
    coordinates = fields.String()

    address_line1 = fields.String()
    city = fields.String()
    state = fields.String()
    zip = fields.String()

    metrics = fields.String()
    volume = fields.Float()

    priority = fields.String(required=True)

    recursion = fields.Boolean()

    frequency = fields.String()

    start_service = fields.DateTime()
    end_service = fields.DateTime()

    created_by = fields.String()



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

            if not data.get("address_line1"):
                raise ValidationError("address required for ADDRESS location")


    @validates_schema
    def validate_fields(self, data, **kwargs):

        # ENUM validation
        if data.get("priority") not in [e.value for e in PriorityEnum]:
            raise ValidationError("Invalid priority")

        if data.get("frequency") and data.get("frequency") not in [e.value for e in FrequencyEnum]:
            raise ValidationError("Invalid frequency")
        
        # RECURSION VALIDATION
        if data.get("recursion") == True and not data.get("frequency"):
            raise ValidationError("frequency required when recursion is TRUE")


workorder_schema = WorkOrderSchema()
workorders_schema = WorkOrderSchema(many=True)
