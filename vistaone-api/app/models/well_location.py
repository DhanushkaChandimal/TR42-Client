import uuid
from sqlalchemy.orm import mapped_column, relationship, Mapped
from app.extensions import db
from app.models.audit_mixin import AuditMixin


class WellLocation(db.Model, AuditMixin):
    __tablename__ = "well_location"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    well_id = mapped_column(
        db.String(36), db.ForeignKey("well.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    surface_latitude = mapped_column(db.Numeric, nullable=True)
    surface_longitude = mapped_column(db.Numeric, nullable=True)
    bottom_latitude = mapped_column(db.Numeric, nullable=True)
    bottom_longitude = mapped_column(db.Numeric, nullable=True)
    county = mapped_column(db.Text, nullable=True)
    state = mapped_column(db.String(2), nullable=True)
    field_name = mapped_column(db.Text, nullable=True)
    section = mapped_column(db.Integer, nullable=True)
    township = mapped_column(db.String(2), nullable=True)

    well = relationship("Well", back_populates="location")
