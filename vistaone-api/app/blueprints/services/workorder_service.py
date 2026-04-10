from datetime import datetime
from app.models.address import Address
from app.models.enums import StatusEnum
from app.extensions import db
from app.models import User, WorkOrder
from  app.blueprints.repository.workorder_repository import WorkOrderRepository
import logging

logger = logging.getLogger(__name__)

# # Service adds business logic like status checks

class WorkOrderService:
           
    @staticmethod
    def create_workorder(data, current_user_id):
        # Set created_by from token, current_user_id automatically comes from token
        try:
            if not current_user_id:
                raise Exception("current_user_id not provided!")

            # HANDLE ADDRESSdress_id = data.get("address_id")

            workorder = WorkOrder(
            client_id=data["client_id"],
            vendor_id=data["vendor_id"],
            service_type_id=data["service_type_id"],
            description=data.get("description"),

            location_type=data["location_type"],
            well_number=data.get("well_number"),
            coordinates=data.get("coordinates"),

            units=data.get("units"),
            estimated_quantity=data.get("estimated_quantity"),

            priority=data["priority"],
            is_recurring=data.get("is_recurring", False),
            recurrence_type=data.get("recurrence_type"),

            estimated_start_date=data.get("estimated_start_date"),
            estimated_end_date=data.get("estimated_end_date"),

            created_by=current_user_id
            )
           
            if data.get("location_type") == "ADDRESS":
                if not data.get("street"):
                    raise Exception("street is required for ADDRESS location")
                else:
                    address = Address(
                        street=data.get("street"),
                        city=data.get("city"),
                        state=data.get("state"),
                            zip=data.get("zip"),
                            created_by=current_user_id 
                        )

                    db.session.add(address)
                    db.session.flush()   # get address_id

                    workorder.address_id = address.address_id

            elif data.get("location_type") == "GPS":
                if not data.get("coordinates"):
                    raise Exception("coordinates is required for GPS location")
                workorder.coordinates = data.get("coordinates")
            elif data.get("location_type") == "WELL":
                if not data.get("well_number"):
                    raise Exception("well_number is required for WELL location")
                workorder.well_number = data.get("well_number")
            
            
        #  Create WorkOrder
            

            created_workorder = WorkOrderRepository.create(workorder)

            return created_workorder

        except Exception as e:
            logger.error(f"Error creating workorder: {str(e)}")
            db.session.rollback() # Undo any partial DB changes if error occurs
            raise e

    @staticmethod
    def get_workorder(work_order_id: str, current_user_id):
            workorder = WorkOrderRepository.get_by_id(work_order_id)
            if not workorder:
                raise ValueError("WorkOrder not found")
            return workorder
      
         
    @staticmethod
    def get_all_workorders():
        return WorkOrderRepository.get_all()

    @staticmethod
    def update_workorder(current_user_id,work_order_id: str, data):
        try:
            workorder = WorkOrderRepository.get_by_id(work_order_id)
            if not workorder:
                raise Exception("WorkOrder not found")
    
            if not current_user_id:
                raise Exception("current_user_id not provided!")  

    
            ## Update other fields
            for key, value in data.items():
                setattr(workorder, key, value)

            workorder.last_modified_by = current_user_id
            workorder.last_modified_date = datetime.utcnow()
            WorkOrderRepository.update()
            return workorder
        except Exception as e:
            db.session.rollback()
            raise e
        
    # Delete    
    @staticmethod
    def delete_workorder(work_order_id: str, current_user_id):

        workorder = WorkOrderRepository.get_by_id(work_order_id)

        if not workorder:
            raise ValueError("WorkOrder not found")    
        
        if not current_user_id:
            raise Exception("current_user_id not provided!")

        # Block deletion for certain statuses
        blocked_statuses = [
            StatusEnum.IN_PROGRESS,
            StatusEnum.COMPLETED,
            StatusEnum.CLOSED,
            StatusEnum.CANCELLED
            ]   

        # prevent deleting completed orders
        if workorder.status in blocked_statuses:
            raise Exception(f"WorkOrder cannot be cancelled because current status is {workorder.status.value}")
        else:
        
            
            workorder.status = StatusEnum.CANCELLED
            workorder.last_modified_by = current_user_id
            workorder.last_modified_date = datetime.utcnow()
            workorder.cancelled_by = current_user_id
            workorder.cancelled_date = datetime.utcnow()
           ## workorder.cancelation_reason = "Cancelled by user" # Optional: Add a reason field in the model for better audit trails

            WorkOrderRepository.cancel()

        return True
 