from sqlalchemy import func
from sqlalchemy.orm import mapped_column, relationship 
from app.extensions import db
from app.blueprints.enum.enums import WellStatusEnum 
import uuid


## Created well model for as a initial model and its not fully complete. 
class Well(db.Model):
    __tablename__ = "wells"

    well_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = mapped_column(db.String(36), db.ForeignKey("clients.client_id"), nullable=False)

    well_number = mapped_column(db.String(50), unique=True, nullable=False)
    well_name = mapped_column(db.String(255), nullable=True)

    operator_name = mapped_column(db.String(255), nullable=True)
    field_name = mapped_column(db.String(255), nullable=True)

    latitude = mapped_column(db.String(50), nullable=True)
    longitude = mapped_column(db.String(50), nullable=True)

    status = mapped_column(db.Enum(WellStatusEnum), default=WellStatusEnum.ACTIVE)

    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())
  
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    # relationship
    client = relationship("Client", back_populates="wells")