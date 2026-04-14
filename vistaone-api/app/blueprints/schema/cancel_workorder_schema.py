from marshmallow import Schema, fields

import logging

logger = logging.getLogger(__name__)

class CancelWorkOrderSchema(Schema):
    class Meta:
        load_instance = True


    cancellation_reason = fields.String(required=True)

cancel_workorder_schema = CancelWorkOrderSchema()