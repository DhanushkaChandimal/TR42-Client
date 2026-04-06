from app.blueprints.repository.workorder_repository import add_workorder
from app.models.enums import StatusEnum


# Service adds business logic like status checks

def create_workorder(workorder):
    # Default status is CREATED
    workorder.status = StatusEnum.CREATED.value

    return add_workorder(workorder)