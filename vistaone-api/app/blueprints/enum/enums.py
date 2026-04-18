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


class WellStatusEnum(Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class VendorStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

    def __str__(self):
        return self.value


class ComplianceStatus(str, Enum):
    EXPIRED = "expired"
    INCOMPLETE = "incomplete"
    COMPLETE = "complete"

    def __str__(self):
        return self.value
