from app.extensions import ma
from marshmallow import fields, EXCLUDE
from app.models.ticket import Ticket
from app.blueprints.enum.enums import TicketStatusEnum


class TicketSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Ticket
        include_fk = True
        load_instance = False
        unknown = EXCLUDE

    id = fields.String(dump_only=True)
    ticket_number = fields.Integer(dump_only=True)
    work_order_id = fields.String(required=True)
    vendor_id = fields.String(required=True)

    title = fields.String(required=True)
    description = fields.String()
    contractor_name = fields.String(allow_none=True)

    status = fields.Enum(TicketStatusEnum, by_value=True)

    scheduled_start = fields.DateTime(allow_none=True)
    scheduled_end = fields.DateTime(allow_none=True)
    completed_at = fields.DateTime(dump_only=True, allow_none=True)

    approved_by = fields.String(dump_only=True, allow_none=True)
    approved_at = fields.DateTime(dump_only=True, allow_none=True)
    rejected_at = fields.DateTime(dump_only=True, allow_none=True)
    rejection_reason = fields.String(allow_none=True)

    notes = fields.String(allow_none=True)

    vendor = fields.Nested("VendorSchema", dump_only=True)


ticket_schema = TicketSchema()
tickets_schema = TicketSchema(many=True)
