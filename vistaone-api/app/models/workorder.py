from sqlalchemy.orm import mapped_column,relationship
from sqlalchemy.sql import func
from app.blueprints.enum.enums import PriorityEnum, StatusEnum, FrequencyEnum, LocationTypeEnum
import uuid
from app.extensions import db
from sqlalchemy import Sequence



class WorkOrder(db.Model):
    __tablename__ = "work_orders"

    id = mapped_column(db.Integer, Sequence('work_order_id_seq'),primary_key=True) # Sequential ID (PRIMARY KEY)
    work_order_id = mapped_column(db.String(36), default=lambda: str(uuid.uuid4()))

    client_id = mapped_column(db.String(36), db.ForeignKey("clients.client_id"), nullable=False) ## client reference
    vendor_id = mapped_column(db.String(36), db.ForeignKey("vendors.vendor_id"), nullable=False) ## assigned_vendor (text) reference to vendor table
    service_type_id = mapped_column(db.String(36), db.ForeignKey("service_types.service_type_id"), nullable=False) ## service_type (text) reference to service type table

    description = mapped_column(db.String(500))

    location_type = mapped_column(db.Enum(LocationTypeEnum), nullable=False)
    
    well_id = mapped_column(db.String(36), db.ForeignKey("wells.well_id")) ## well table reference if location_type is WELL
    well= relationship("Well", back_populates="workorders")
   
    latitude = mapped_column(db.Float, nullable=True)
    longitude = mapped_column(db.Float, nullable=True)
  

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
    cancellation_reason = mapped_column(db.String(255), nullable=True)

    address_id = mapped_column(db.String(36), db.ForeignKey("address.address_id")) ## address reference if location_type is ADDRESS
    address = relationship("Address", back_populates="workorders")
    
    ## Relationships
    client = relationship("Client", back_populates="workorders")
    vendor = relationship("Vendor", back_populates="workorders")
    service_type = relationship("ServiceType", back_populates="workorders")
    well = relationship("Well", back_populates="workorders")