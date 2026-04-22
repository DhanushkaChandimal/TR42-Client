from app.extensions import ma
from marshmallow import fields, EXCLUDE
from app.models.invoice import Invoice
from app.models.line_item import LineItem
from app.blueprints.enum.enums import InvoiceStatusEnum
import logging

logger = logging.getLogger(__name__)


class LineItemSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = LineItem
        include_fk = True
        load_instance = False
        unknown = EXCLUDE

    id = fields.String(dump_only=True)
    invoice_id = fields.String(required=True)
    quantity = fields.Integer(required=True)
    rate = fields.Float(required=True)
    amount = fields.Float(required=True)
    description = fields.String()


class InvoiceSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Invoice
        include_fk = True
        load_instance = False
        unknown = EXCLUDE

    id = fields.String(dump_only=True)
    work_order_id = fields.Integer(required=True)
    vendor_id = fields.String(required=True)
    client_id = fields.String(required=True)
    invoice_date = fields.DateTime(required=True)
    due_date = fields.DateTime(required=True)
    period_start = fields.DateTime()
    period_end = fields.DateTime()
    total_amount = fields.Float(required=True)
    invoice_status = fields.Enum(InvoiceStatusEnum, by_value=True)

    ## Nested relationships for output
    vendor = fields.Nested("VendorSchema", dump_only=True)
    line_items = fields.Nested(LineItemSchema, many=True, dump_only=True)


invoice_schema = InvoiceSchema()
invoices_schema = InvoiceSchema(many=True)
line_item_schema = LineItemSchema()
line_items_schema = LineItemSchema(many=True)
