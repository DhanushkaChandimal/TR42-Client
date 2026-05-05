from app.extensions import ma
from marshmallow import fields, EXCLUDE
from app.models.ticket import Ticket
from app.models.workorder import WorkOrder
from app.blueprints.enum.enums import TicketStatusEnum, PriorityEnum
from app.blueprints.schema.invoice_schema import InvoiceSchema
from app.blueprints.schema.service_schema import ServiceSchema


class WorkOrderSummarySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = WorkOrder
        fields = (
            "id",
            "work_order_code",
            "description",
            "estimated_cost",
            "estimated_duration",
            "estimated_quantity",
            "units",
        )

    estimated_cost = fields.Float()
    estimated_duration = fields.TimeDelta()


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
    approved_at = fields.DateTime(allow_none=True)
    rejected_at = fields.DateTime(allow_none=True)
    estimated_duration = fields.TimeDelta(allow_none=True)

    service_type = fields.String(required=True)

    notes = fields.String(allow_none=True)
    contractor_start_latitude = fields.Decimal(allow_none=True, as_string=True)
    contractor_start_longitude = fields.Decimal(allow_none=True, as_string=True)
    contractor_end_latitude = fields.Decimal(allow_none=True, as_string=True)
    contractor_end_longitude = fields.Decimal(allow_none=True, as_string=True)
    estimated_quantity = fields.Float(allow_none=True)
    unit = fields.String(allow_none=True)
    special_requirements = fields.String(allow_none=True)
    anomaly_flag = fields.Boolean(allow_none=True)
    anomaly_reason = fields.String(allow_none=True)
    additional_information = fields.Dict(allow_none=True)
    route = fields.String(allow_none=True)

    vendor = fields.Nested("VendorSchema", dump_only=True)
    invoice = fields.Nested(InvoiceSchema, dump_only=True)
    service = fields.Nested(ServiceSchema, dump_only=True)
    work_order = fields.Nested(WorkOrderSummarySchema, dump_only=True)

    actual_duration_seconds = fields.Method("_actual_duration_seconds", dump_only=True)

    def _actual_duration_seconds(self, obj):
        start = getattr(obj, "start_time", None)
        end = getattr(obj, "end_time", None)
        if start is None or end is None:
            return None
        delta = end - start
        if delta.total_seconds() < 0:
            return None
        return delta.total_seconds()


ticket_schema = TicketSchema()
tickets_schema = TicketSchema(many=True)
