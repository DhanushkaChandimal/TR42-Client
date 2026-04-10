from enum import Enum

class PriorityEnum(Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class StatusEnum(Enum):
    UNASSIGNED = "UNASSIGNED"
    ASSIGNED = "ASSIGNED"
    APPROVED = "APPROVED"
    CANCELLED = "CANCELLED"
    IN_PROGRESS = "IN_PROGRESS"  
    COMPLETED = "COMPLETED"
    CLOSED = "CLOSED"
  

class FrequencyEnum(Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    ONE_TIME = "ONE_TIME"


class LocationTypeEnum(Enum):
    WELL = "WELL"
    GPS = "GPS"
    ADDRESS = "ADDRESS"