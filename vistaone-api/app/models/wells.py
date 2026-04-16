from sqlalchemy import func
from sqlalchemy.orm import mapped_column, relationship
from app.extensions import db
from app.blueprints.enum.enums import WellStatusEnum
import uuid
from sqlalchemy.dialects.postgresql import UUID


class Well(db.Model):
    __tablename__ = "wells"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = mapped_column(
        db.String(36), db.ForeignKey("clients.client_id"), nullable=False
    )

    well_number = mapped_column(db.String(50), unique=True, nullable=False)
    well_name = mapped_column(db.String(255), nullable=True)
    latitude = mapped_column(db.String(50), nullable=True)
    longitude = mapped_column(db.String(50), nullable=True)
    status = mapped_column(db.Enum(WellStatusEnum), default=WellStatusEnum.ACTIVE)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    # relationships
    client = relationship("Client", back_populates="wells")
    workorders = relationship("WorkOrder", back_populates="well")
