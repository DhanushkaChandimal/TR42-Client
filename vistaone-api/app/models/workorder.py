from sqlalchemy import String, Integer, Date, Time, Boolean, Enum as SQLEnum, DateTime
from sqlalchemy.orm import mapped_column,relationship
from sqlalchemy.sql import func
from .enums import PriorityEnum, StatusEnum, FrequencyEnum, LocationTypeEnum
from datetime import datetime
import uuid
from app.extensions import db



##  I will create the work order model, that references for test purposes to create client, vendor and service type models. I will also create the relationships between these models. this is my reference to understand the relationships between the models. 



class Client(db.Model):
    __tablename__ = "clients"

    client_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = mapped_column(db.String(255), nullable=False)
    created_at = mapped_column(db.DateTime, default=datetime.utcnow)
    workorders = relationship("WorkOrder", back_populates="client")

    address_id = mapped_column(db.String(36), db.ForeignKey("address.address_id"))
    address = relationship("Address")

class Vendor(db.Model):
    __tablename__ = "vendors"

    vendor_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = mapped_column(db.String(255), nullable=False)
    created_at = mapped_column(db.DateTime, default=datetime.utcnow)
    workorders = relationship("WorkOrder", back_populates="vendor")

    address_id = mapped_column(db.String(36), db.ForeignKey("address.address_id"))
    address = relationship("Address")


class ServiceType(db.Model):
    __tablename__ = "service_types"

    service_type_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    service = mapped_column(db.String(255), nullable=False)
    workorders = relationship("WorkOrder", back_populates="service_type")



class WorkOrder(db.Model):
    __tablename__ = "work_orders"

    work_order_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    client_id = mapped_column(db.String(36), db.ForeignKey("clients.client_id"), nullable=False)
    vendor_id = mapped_column(db.String(36), db.ForeignKey("vendors.vendor_id"), nullable=False) ## assigned_vendor (text)
    service_type_id = mapped_column(db.String(36), db.ForeignKey("service_types.service_type_id"), nullable=False) ## service_type (text)

    description = mapped_column(db.String(500))

    location_type = mapped_column(db.Enum(LocationTypeEnum), nullable=False)
    well_number = mapped_column(db.String(50)) ## well_id (text)  => need to change to table??
    coordinates = mapped_column(db.String(100)) ## latitude geography , ## longitude geography
    # address_line1 = mapped_column(db.String(255))
    # address_line2 = mapped_column(db.String(255))
    # street = mapped_column(db.String(255))
    # city = mapped_column(db.String(100))
    # state = mapped_column(db.String(100))
    # county = mapped_column(db.String(100))
    # zip = mapped_column(db.String(20))

    units = mapped_column(db.String(100)) 
    estimated_quantity = mapped_column(db.Float, nullable=True)

    priority = mapped_column(db.Enum(PriorityEnum), nullable=False)

    status = mapped_column(db.Enum(StatusEnum), default=StatusEnum.UNASSIGNED)

    is_recurring = mapped_column(db.Boolean, default=False)
    recurrence_type = mapped_column(db.Enum(FrequencyEnum), default=FrequencyEnum.ONE_TIME)

    estimated_start_date = mapped_column(db.DateTime, nullable=True)
    estimated_end_date = mapped_column(db.DateTime, nullable=True)

    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now())

  
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    cancelled_by = mapped_column(db.String(100))
    cancelled_date = mapped_column(db.DateTime)
   # cancellaton_reason = mapped_column(db.String(255))

    address_id = mapped_column(db.String(36), db.ForeignKey("address.address_id"))
    address = relationship("Address")
    

    # # Relationships
    client = relationship("Client", back_populates="workorders")
    vendor = relationship("Vendor", back_populates="workorders")
    service_type = relationship("ServiceType", back_populates="workorders")