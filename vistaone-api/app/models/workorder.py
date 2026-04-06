from sqlalchemy import String, Integer, Date, Time, Boolean, Enum as SQLEnum, DateTime
from sqlalchemy.orm import mapped_column,relationship
from sqlalchemy.sql import func
from . import Base, db
from .enums import PriorityEnum, StatusEnum, FrequencyEnum, LocationTypeEnum
from datetime import datetime
import uuid



##  I will create the work order model, that references for test purposes to create client, vendor and service type models. I will also create the relationships between these models. this is my reference to understand the relationships between the models. 
class Client(db.Model):
    __tablename__ = "clients"

    client_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = mapped_column(db.String(255), nullable=False)
    created_at = mapped_column(db.DateTime, default=datetime.utcnow)
    workorders = relationship("WorkOrder", back_populates="client")

class Vendor(db.Model):
    __tablename__ = "vendors"

    vendor_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = mapped_column(db.String(255), nullable=False)
    created_at = mapped_column(db.DateTime, default=datetime.utcnow)
    workorders = relationship("WorkOrder", back_populates="vendor")


class ServiceType(db.Model):
    __tablename__ = "service_types"

    service_type_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = mapped_column(db.String(255), nullable=False)
    workorders = relationship("WorkOrder", back_populates="service_type")



class WorkOrder(db.Model):
    __tablename__ = "work_orders"

    work_order_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    client_id = mapped_column(db.String(36), db.ForeignKey("clients.client_id"), nullable=False)
    vendor_id = mapped_column(db.String(36), db.ForeignKey("vendors.vendor_id"), nullable=False)
    service_type_id = mapped_column(db.String(36), db.ForeignKey("service_types.service_type_id"), nullable=False)

    description = mapped_column(db.String(500))

    location_type = mapped_column(db.Enum(LocationTypeEnum), nullable=False)
    well_number = mapped_column(db.String(50))
    coordinates = mapped_column(db.String(100))
    address_line1 = mapped_column(db.String(255))
    address_line2 = mapped_column(db.String(255))
    city = mapped_column(db.String(100))
    state = mapped_column(db.String(100))
    county = mapped_column(db.String(100))
    zip = mapped_column(db.String(20))

    metrics = mapped_column(db.String(100))
    volume = mapped_column(db.Float)

    priority = mapped_column(db.Enum(PriorityEnum), nullable=False)

    status = mapped_column(db.Enum(StatusEnum), default=StatusEnum.CREATED)

    recursion = mapped_column(db.Boolean, default=False)
    frequency = mapped_column(db.Enum(FrequencyEnum))

    start_service = mapped_column(db.DateTime)
    end_service = mapped_column(db.DateTime)

    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, default=datetime.utcnow)
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    # # Relationships
    client = relationship("Client", back_populates="workorders")
    vendor = relationship("Vendor", back_populates="workorders")
    service_type = relationship("ServiceType", back_populates="workorders")