from sqlalchemy import String, Integer, Date, Time, Boolean, Enum as SQLEnum, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from . import Base, db
from .enums import PriorityEnum, FrequencyEnum, JobTypeEnum, LocationTypeEnum, VendorEnum

class WorkOrder(Base):
    __tablename__ = "work_orders"

    work_order_id: Mapped[str] = mapped_column(String(50), primary_key=True)  # String primary key

    job_type: Mapped[JobTypeEnum] = mapped_column(SQLEnum(JobTypeEnum), nullable=False)
    units: Mapped[int] = mapped_column(Integer, nullable=True)

    vendor_id: Mapped[VendorEnum] = mapped_column(SQLEnum(VendorEnum), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    location_type: Mapped[LocationTypeEnum] = mapped_column(SQLEnum(LocationTypeEnum))
    well_number: Mapped[str] = mapped_column(String(20), nullable=True)
    coordinates: Mapped[str] = mapped_column(String(50), nullable=True)

    address: Mapped[str] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=True)
    state: Mapped[str] = mapped_column(String(50), nullable=True)
    zip: Mapped[str] = mapped_column(String(10), nullable=True)

    begin_date: Mapped[Date] = mapped_column(Date, nullable=False)
    begin_time: Mapped[Time] = mapped_column(Time, nullable=False)
    priority: Mapped[PriorityEnum] = mapped_column(SQLEnum(PriorityEnum), nullable=False)

    recursion: Mapped[Boolean] = mapped_column(Boolean, default=False)
    frequency: Mapped[FrequencyEnum] = mapped_column(SQLEnum(FrequencyEnum), nullable=True)
    #start_service: Mapped[Date] = mapped_column(Date, nullable=True)
    end_service: Mapped[Date] = mapped_column(Date, nullable=True)

    client_id: Mapped[str] = mapped_column(String(50), nullable=True)

    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    created_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_modified_by: Mapped[str] = mapped_column(String(50), nullable=True)
    last_modified_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), onupdate=func.now())