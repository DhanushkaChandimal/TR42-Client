from app.extensions import ma, db
from marshmallow import EXCLUDE, fields, validates_schema, ValidationError
from app.models import WorkOrder
from app.blueprints.enum.enums import (
    PriorityEnum,
    FrequencyEnum,
    LocationTypeEnum,
    StatusEnum,
)
import logging

logger = logging.getLogger(__name__)


class WorkOrderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = WorkOrder
        include_fk = True
        load_instance = False
        unknown = EXCLUDE

    id = fields.String(dump_only=True)
    work_order_code = fields.Int(allow_none=True)

    client_id = fields.String(required=True)
    assigned_vendor = fields.String(allow_none=True)
    service_type = fields.String(required=True)
    description = fields.String(required=True)
    comments = fields.String(allow_none=True)

    location_type = fields.Enum(LocationTypeEnum, by_value=True, allow_none=True)
    location = fields.String(allow_none=True)

    street = fields.String(load_only=True, allow_none=True)
    city = fields.String(load_only=True, allow_none=True)
    state = fields.String(load_only=True, allow_none=True)
    zip = fields.String(load_only=True, allow_none=True)
    country = fields.String(load_only=True, allow_none=True)

    address = fields.Method("get_address", dump_only=True)

    well_id = fields.String(allow_none=True)
    latitude = fields.Decimal(allow_none=True, as_string=True)
    longitude = fields.Decimal(allow_none=True, as_string=True)

    units = fields.String(allow_none=True)
    estimated_quantity = fields.Float(allow_none=True)

    priority = fields.Enum(PriorityEnum, by_value=True, required=True)

    is_recurring = fields.Boolean()
    recurrence_type = fields.Enum(FrequencyEnum, by_value=True)

    estimated_start_date = fields.DateTime(allow_none=True)
    estimated_end_date = fields.DateTime(allow_none=True)
    assigned_at = fields.DateTime(allow_none=True, dump_only=True)
    completed_at = fields.DateTime(allow_none=True, dump_only=True)
    closed_at = fields.DateTime(allow_none=True, dump_only=True)
    halted_at = fields.DateTime(allow_none=True, dump_only=True)
    rejected_at = fields.DateTime(allow_none=True, dump_only=True)
    cancelled_at = fields.DateTime(allow_none=True, dump_only=True)
    cancellation_reason = fields.String(allow_none=True, dump_only=True)

    current_status = fields.Enum(StatusEnum, by_value=True)
    display_status = fields.Method("compute_display_status", dump_only=True)

    vendor = fields.Nested("VendorSchema", dump_only=True)
    service = fields.Nested("ServiceSchema", dump_only=True)

    def get_address(self, obj):
        from app.models.address import Address

        if obj.location_type != LocationTypeEnum.ADDRESS or not obj.location:
            return None
        addr = db.session.get(Address, obj.location)
        if not addr:
            return None
        return {
            "id": addr.id,
            "street": addr.street,
            "city": addr.city,
            "state": addr.state,
            "zip": addr.zip,
            "country": addr.country,
        }

    def compute_display_status(self, obj):
        from app.models.invoice import Invoice
        from app.blueprints.enum.enums import InvoiceStatusEnum

        invoices = Invoice.query.filter_by(work_order_id=obj.id).all()
        if not invoices:
            return obj.current_status.value if obj.current_status else None

        statuses = {inv.invoice_status for inv in invoices}
        if InvoiceStatusEnum.REJECTED in statuses:
            return "INVOICE_REJECTED"
        if InvoiceStatusEnum.SUBMITTED in statuses:
            return "PENDING_REVIEW"
        return obj.current_status.value if obj.current_status else None

    @validates_schema
    def validate_fields(self, data, **kwargs):
        if data.get("is_recurring") is True and not data.get("recurrence_type"):
            raise ValidationError("recurrence_type required when is_recurring is TRUE")

    @validates_schema
    def validate_location(self, data, **kwargs):
        location_type = data.get("location_type")

        if not location_type:
            return

        has_location = bool(data.get("location"))
        has_gps = data.get("latitude") is not None or data.get("longitude") is not None
        has_well = data.get("well_id") is not None

        if location_type == LocationTypeEnum.ADDRESS:
            has_address_fields = bool(
                data.get("street") and data.get("city") and data.get("zip")
            )
            if not has_address_fields and not has_location:
                raise ValidationError("street, city, and zip required for ADDRESS")
            if has_gps or has_well:
                raise ValidationError("Only ADDRESS allowed")

        elif location_type == LocationTypeEnum.GPS:
            if not has_gps:
                raise ValidationError("latitude & longitude required")
            if has_location or has_well:
                raise ValidationError("Only GPS allowed")

        elif location_type == LocationTypeEnum.WELL:
            if not has_well:
                raise ValidationError("well_id required")
            if has_location or has_gps:
                raise ValidationError("Only WELL allowed")


workorder_schema = WorkOrderSchema()
workorders_schema = WorkOrderSchema(many=True)
