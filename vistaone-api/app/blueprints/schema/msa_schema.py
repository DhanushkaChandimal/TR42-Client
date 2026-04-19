from app.extensions import ma
from app.models.msa import Msa
from marshmallow import fields


class MsaSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Msa
        load_instance = True
        include_fk = True
        exclude = ("vendor",)

    effective_date = fields.Date(format="iso")
    expiration_date = fields.Date(format="iso")


msa_schema = MsaSchema()
msas_schema = MsaSchema(many=True)
