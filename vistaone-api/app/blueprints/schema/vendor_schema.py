from app.extensions import ma
from app.models.vendor import Vendor
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

    # Flatten vendor_services -> list of {id, service} for service_type
    services = fields.Method("get_services")

    def get_services(self, obj):
        return [
            {"id": vs.service_type.id, "service": vs.service_type.service}
            for vs in (obj.vendor_services or [])
            if vs.service_type
        ]


vendor_schema = VendorSchema()
vendors_schema = VendorSchema(many=True)
