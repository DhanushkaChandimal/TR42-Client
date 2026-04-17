from app.extensions import ma
from app.models.clientapp_model import Vendor
from marshmallow import fields


# Vendor schema for serializing vendor records to JSON
# Excludes relationship collections (workorders) since we only need vendor data
class VendorSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Vendor
        load_instance = True
        include_fk = True
        exclude = ('workorders',)

    # Serialize enum fields as their string values (e.g. "active" not "VendorStatus.ACTIVE")
    status = fields.String()
    compliance_status = fields.String()


vendor_schema = VendorSchema()
vendors_schema = VendorSchema(many=True)
