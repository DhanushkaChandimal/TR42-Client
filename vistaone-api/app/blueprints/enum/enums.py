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


class UserType(str, Enum):
    CLIENT = "client"
    VENDOR = "vendor"
    CONTRACTOR = "contractor"


class UserStatus(str, Enum):
    PENDING_EMAIL_VERIFICATION = "pending_email_verification"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    REJECTED = "rejected"
    INACTIVE = "inactive"
    DELETED = "deleted"
class InvoiceStatusEnum(Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PAID = "PAID"
