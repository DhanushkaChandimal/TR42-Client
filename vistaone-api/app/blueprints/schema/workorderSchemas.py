from marshmallow import Schema, fields
from app.extensions import ma
from app.models import WorkOrder


class WorkOrderSchema(ma.SQLAlchemyAutoSchema):

    class Meta:
        model = WorkOrder
        load_instance = False

    work_order_id = fields.String(dump_only=True)
    description = fields.String(required=True)
    current_status = fields.String(required=True)
    priority = fields.String(required=True)
    created_by = fields.String(required=False)
    created_at = fields.DateTime(dump_only=True)



workorder_schema = WorkOrderSchema()
workorders_schema = WorkOrderSchema(many=True)