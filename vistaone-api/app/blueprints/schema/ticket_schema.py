from app.extensions import ma
from marshmallow import fields, EXCLUDE
from app.models.ticket import Ticket
from app.blueprints.enum.enums import TicketStatusEnum, PriorityEnum


class TicketSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Ticket
        include_fk = True
        load_instance = False
        unknown = EXCLUDE

    id = fields.String(dump_only=True)
    work_order_id = fields.String(required=True)
    invoice_id = fields.String(allow_none=True)
    description = fields.String(required=True)
    assigned_contractor = fields.String(allow_none=True)
    priority = fields.Enum(PriorityEnum, by_value=True, required=True)
    status = fields.Enum(TicketStatusEnum, by_value=True)
    vendor_id = fields.String(required=True)

    start_time = fields.DateTime(allow_none=True)
    due_date = fields.DateTime(required=True)
    assigned_at = fields.DateTime(allow_none=True)
    end_time = fields.DateTime(allow_none=True)
    estimated_duration = fields.TimeDelta(allow_none=True)

    service_type = fields.String(required=True)

    notes = fields.String(allow_none=True)
    contractor_start_location = fields.String(allow_none=True)
    contractor_end_location = fields.String(allow_none=True)
    estimated_quantity = fields.Float(allow_none=True)
    unit = fields.String(allow_none=True)
    special_requirements = fields.String(allow_none=True)
    anomaly_flag = fields.Boolean(allow_none=True)
    anomaly_reason = fields.String(allow_none=True)
    additional_information = fields.Dict(allow_none=True)
    route = fields.String(allow_none=True)

    vendor = fields.Nested("VendorSchema", dump_only=True)


ticket_schema = TicketSchema()
tickets_schema = TicketSchema(many=True)
