from marshmallow import Schema, fields

import logging

logger = logging.getLogger(__name__)

class DeleteWorkOrderSchema(Schema):
    class Meta:
        load_instance = True

    work_order_id = fields.String(required=True)
    cancellation_reason = fields.String(required=True)

delete_workorder_schema = DeleteWorkOrderSchema()