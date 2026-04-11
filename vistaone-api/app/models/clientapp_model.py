from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import mapped_column,relationship
from sqlalchemy.sql import func
import uuid
from app.extensions import db


##  I will create the work order model, that references for test purposes to create client, vendor and service type models. I will also create the relationships between these models. this is my reference to understand the relationships between the models. 
# incomplete models needs to be added to the database for testing purposes.
class Client(db.Model):
    __tablename__ = "clients"

    client_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = mapped_column(db.String(255), nullable=False)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now()) 
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    #  ONE CLIENT → MANY WELLS
    wells = relationship("Well", back_populates="client")
    workorders = relationship("WorkOrder", back_populates="client")

    address_id = mapped_column(db.String(36), db.ForeignKey("address.address_id"))
    address = relationship("Address")

# incomplete models needs to be added to the database for testing purposes.
class Vendor(db.Model):
    __tablename__ = "vendors"

    vendor_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = mapped_column(db.String(255), nullable=False)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now()) 
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    workorders = relationship("WorkOrder", back_populates="vendor")

    address_id = mapped_column(db.String(36), db.ForeignKey("address.address_id"))
    address = relationship("Address")

# incomplete models needs to be added to the database for testing purposes.
class ServiceType(db.Model):
    __tablename__ = "service_types"

    service_type_id = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    service = mapped_column(db.String(255), nullable=False)
    created_by = mapped_column(db.String(100))
    created_date = mapped_column(db.DateTime, server_default=func.now()) 
    last_modified_by = mapped_column(db.String(100))
    last_modified_date = mapped_column(db.DateTime)

    workorders = relationship("WorkOrder", back_populates="service_type")