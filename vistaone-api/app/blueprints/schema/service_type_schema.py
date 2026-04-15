from app.extensions import ma
from app.models.clientapp_model import ServiceType

class ServiceTypeSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = ServiceType
        fields = ("service_type_id", "service")

service_type_schema = ServiceTypeSchema()
service_types_schema = ServiceTypeSchema(many=True)
