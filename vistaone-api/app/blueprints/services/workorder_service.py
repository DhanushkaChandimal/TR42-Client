from datetime import datetime
from app.models.address import Address
from app.extensions import db
from app.models import WorkOrder
from  app.blueprints.repository.workorder_repository import WorkOrderRepository
import logging
from app.blueprints.enum.enums import LocationTypeEnum, StatusEnum, FrequencyEnum

logger = logging.getLogger(__name__)

## Service adds business logic like status checks

class WorkOrderService:

    @staticmethod
    def create_workorder(validated_workorder_data, current_user_id):
        # Set created_by from token, current_user_id automatically comes from token
        try:            
            # REMOVE ADDRESS FIELDS FROM WORKORDER INPUT Remove INVALID MODEL FIELDS
            address_fields = ["street", "city", "state", "zip"]
            address_data = {k: validated_workorder_data.pop(k, None) for k in address_fields}
            

            work_order = WorkOrder(**validated_workorder_data)
            if work_order.is_recurring != True:
                work_order.recurrence_type = FrequencyEnum.ONE_TIME.value;
            work_order.created_by = current_user_id          

            location_type = validated_workorder_data.get("location_type")
            logger.info(f"Creating workorder with location type: {location_type}")
            logger.info(f"Validated workorder data: {LocationTypeEnum.ADDRESS}")
            # ---------------- ADDRESS ----------------
            if location_type == LocationTypeEnum.ADDRESS:
                if not address_data.get("street") or not address_data.get("city") or not address_data.get("state") or not address_data.get("zip"):
                    raise Exception("Invalid address location - street, city, state, zip are required")
                
                address = Address(
                        street=address_data.get("street"),
                        city=address_data.get("city"),
                        state=address_data.get("state"),
                        zip=address_data.get("zip"),
                        created_by=current_user_id 
                        )

                db.session.add(address)
                db.session.flush()  # get address_id

                work_order.address_id = address.address_id

             # ---------------- GPS ----------------
            elif location_type == LocationTypeEnum.GPS:
                if not validated_workorder_data.get("latitude") or not validated_workorder_data.get("longitude"):
                    raise Exception("latitude & longitude required")

                work_order.latitude = validated_workorder_data.get("latitude")
                work_order.longitude = validated_workorder_data.get("longitude")
             # ---------------- WELL ----------------
            elif location_type == LocationTypeEnum.WELL:
                if not validated_workorder_data.get("well_id"):
                    raise Exception("well_id is required for WELL location")
                work_order.well_id = validated_workorder_data.get("well_id")
                       
        #  Create WorkOrder            
            created_workorder = WorkOrderRepository.create(work_order)
            return created_workorder

        except Exception as e:
            logger.error(f"Error creating workorder: {str(e)}")
            raise e

    @staticmethod
    def get_workorder(work_order_id: str, current_user_id):
            workorder = WorkOrderRepository.get_by_work_order_id(work_order_id)
            if not workorder:
                raise ValueError("WorkOrder not found")
            return workorder
      
         
    @staticmethod
    def get_all_workorders():
        return WorkOrderRepository.get_all()

    @staticmethod
    def update_workorder(current_user_id,work_order_id: str, data):
        try:
            workorder = WorkOrderRepository.get_by_work_order_id(work_order_id)
            if not workorder:
                raise Exception("WorkOrder not found")
    
            if not current_user_id:
                raise Exception("current_user_id not provided!")  
            
            address_fields = ["street", "city", "state", "zip", "country"]
            
            location_type = data.get("location_type", workorder.location_type)

            ALLOWED_FIELDS = {
                            "status",
                            "well_id",
                            "vendor_id",
                            "service_type_id",
                            "description",
                            "priority",
                            "is_recurring",
                            "recurrence_type",
                            "estimated_start_date",
                            "estimated_end_date",
                            "latitude",
                            "longitude",
                            "address_id",
                            "client_id",
                            "units",
                            "estimated_quantity",
                            "location_type"   
                        }
                            
            ##  Update WorkOrder fields
            for key, value in data.items():
                if key in ALLOWED_FIELDS:
                    setattr(workorder, key, value)
            
            if hasattr(workorder, "is_recurring"):
                if workorder.is_recurring is False or workorder.is_recurring == "false":
                    workorder.recurrence_type = FrequencyEnum.ONE_TIME.value
            
            #---------------- LOCATION UPDATE LOGIC ----------------

            if location_type == LocationTypeEnum.ADDRESS:

                # clear other location types
                workorder.latitude = None
                workorder.longitude = None
                workorder.well_id = None
            
                if workorder.address:
                    for key in address_fields:
                        if key in data:
                            setattr(workorder.address, key, data[key])

                    workorder.address.last_modified_by = current_user_id
                    workorder.address.last_modified_date = datetime.now()

                elif any(k in data for k in address_fields):
                    address = Address(
                    street=data.get("street"),
                    city=data.get("city"),
                    state=data.get("state"),
                    zip=data.get("zip"),
                    created_by=current_user_id)

                    db.session.add(address)
                    db.session.flush()   # get address_id
                    workorder.address_id = address.address_id
                    workorder.address = address # link relationship

                    address.last_modified_by = current_user_id
                    address.last_modified_date = datetime.now()
             
            # ---------------- GPS ----------------
            elif location_type == LocationTypeEnum.GPS:

                # clear other location types
                workorder.address_id = None
                workorder.well_id = None


                lat = data.get("latitude")
                lng = data.get("longitude")

                if lat is None or lng is None:
                    raise Exception("latitude & longitude required")

                workorder.latitude = lat
                workorder.longitude = lng
            # ---------------- WELL ----------------
            elif location_type == LocationTypeEnum.WELL:

                # clear other location types
                workorder.address_id = None
                workorder.latitude = None
                workorder.longitude = None

                if not data.get("well_id"):
                    raise Exception("well_id is required for WELL location")
                
                workorder.well_id = data.get("well_id")


            workorder.last_modified_by = current_user_id
            workorder.last_modified_date = datetime.now()
            WorkOrderRepository.update(workorder)
            return workorder
            
        except Exception as e:
            logger.error(f"Error updating workorder: {str(e)}")
            raise e
        
    # Delete    
    @staticmethod
    def cancel_workorder(work_order_id, cancellation_reason, current_user_id):
        
        try:
            logger.info(f"Attempting to cancel workorder with ID: {work_order_id}")            
            workorder = WorkOrderRepository.get_by_work_order_id(work_order_id)
        except Exception as e:
            logger.error(f"Error retrieving workorder: {str(e)}")
            raise e
    

        if not workorder:
            raise ValueError("WorkOrder not found")    

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
            workorder.last_modified_date = datetime.now()
            workorder.cancelled_by = current_user_id
            workorder.cancelled_date = datetime.now()
            workorder.cancellation_reason = cancellation_reason
            WorkOrderRepository.update(workorder)

        return True
    


    @staticmethod
    def search_workorders(search_text, status, page, per_page, sort_by, order):
        return WorkOrderRepository.search(
            search_text=search_text,
            status=status,
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            order=order
        )
 

