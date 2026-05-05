from sqlalchemy.orm import mapped_column, relationship, Mapped
from app.extensions import db
from app.blueprints.enum.enums import WellStatusEnum, WellTypeEnum
import uuid
from app.models.audit_mixin import AuditMixin


class Well(db.Model, AuditMixin):
    __tablename__ = "well"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    client_id = mapped_column(db.String(36), db.ForeignKey("client.id"), nullable=True)

    api_number = mapped_column(db.String(50), unique=True, nullable=False)
    well_name = mapped_column(db.String(255), nullable=False)
    type = mapped_column(db.Enum(WellTypeEnum), nullable=True)
    status = mapped_column(db.Enum(WellStatusEnum), default=WellStatusEnum.ACTIVE)

    range = mapped_column(db.String(2), nullable=True)
    quarter = mapped_column(db.String(2), nullable=True)
    ground_elevation = mapped_column(db.Integer, nullable=True)
    total_depth = mapped_column(db.Integer, nullable=True)
    geofence_radius = mapped_column(db.Integer, nullable=True)
    spud_date = mapped_column(db.DateTime(timezone=True), nullable=True)
    completion_date = mapped_column(db.DateTime(timezone=True), nullable=True)

    access_instructions = mapped_column(db.Text, nullable=True)
    safety_notes = mapped_column(db.Text, nullable=True)

    client = relationship("Client", back_populates="wells")
    location = relationship(
        "WellLocation", back_populates="well", uselist=False, cascade="all, delete-orphan"
    )
