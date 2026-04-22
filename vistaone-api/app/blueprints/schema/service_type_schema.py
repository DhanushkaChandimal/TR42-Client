from app.extensions import ma
from app.models.service_type import ServiceType


class ServiceTypeSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = ServiceType
        fields = ("id", "service")


service_type_schema = ServiceTypeSchema()
service_types_schema = ServiceTypeSchema(many=True)
