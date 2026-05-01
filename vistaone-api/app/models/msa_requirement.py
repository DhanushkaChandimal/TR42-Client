from sqlalchemy.orm import mapped_column, relationship
import uuid
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class MsaRequirement(db.Model, AuditMixin):
    """Generic store for facts extracted from an MSA.

    One row per fact: executive_summary, key_term, risk, red_flag, action_item,
    or pricing rate. The category + rule_type pair distinguishes them. Pricing
    rows use category="pricing" with value/unit set. Source-of-truth fields
    (page_number, extracted_text, confidence_score) support traceability back
    to the original document. metadata JSON catches anything that doesn't fit a
    column (e.g. run_id for run versioning, currency, severity, priority).
    """

    __tablename__ = "msa_requirement"

    id = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    msa_id = mapped_column(db.String(36), db.ForeignKey("msa.id"), nullable=False)
    category = mapped_column(db.String(50))
    rule_type = mapped_column(db.String(50))
    description = mapped_column(db.Text)
    value = mapped_column(db.String(100))
    unit = mapped_column(db.String(100))
    source_field_id = mapped_column(db.String(36))
    page_number = mapped_column(db.Integer)
    extracted_text = mapped_column(db.Text)
    confidence_score = mapped_column(db.Float)
    # Python attribute renamed to avoid clashing with SQLAlchemy's reserved
    # `metadata` on Declarative classes. The DB column is still "metadata".
    extra_metadata = mapped_column("metadata", db.JSON, nullable=True)

    msa = relationship("Msa")
