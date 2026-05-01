from app.extensions import ma
from app.models.msa_requirement import MsaRequirement
from marshmallow import fields


class MsaRequirementSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = MsaRequirement
        load_instance = True
        include_fk = True
        exclude = ("msa",)

    extra_metadata = fields.Raw(attribute="extra_metadata", data_key="metadata")


msa_requirement_schema = MsaRequirementSchema()
msa_requirements_schema = MsaRequirementSchema(many=True)
