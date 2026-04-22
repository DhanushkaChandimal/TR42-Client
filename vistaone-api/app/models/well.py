from sqlalchemy.orm import mapped_column, relationship, Mapped
from app.extensions import db
from app.blueprints.enum.enums import WellStatusEnum
import uuid
from app.models.audit_mixin import AuditMixin


class Well(db.Model, AuditMixin):
    __tablename__ = "well"

    id: Mapped[str] = mapped_column(
        db.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    client_id = mapped_column(db.String(36), db.ForeignKey("client.id"), nullable=False)

    well_number = mapped_column(db.String(50), unique=True, nullable=False)
    well_name = mapped_column(db.String(255), nullable=True)
    latitude = mapped_column(db.String(50), nullable=True)
    longitude = mapped_column(db.String(50), nullable=True)
    status = mapped_column(db.Enum(WellStatusEnum), default=WellStatusEnum.ACTIVE)

    # relationships
    client = relationship("Client", back_populates="wells")
