from uuid import UUID
from app.models.well import Well
from app.blueprints.repository.well_repository import WellRepository
from app.extensions import db
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class WellService:
    @staticmethod
    def create_well(well: Well, current_user_id: str):
        try:
            well.created_by = current_user_id
            well.created_date = datetime.now()
            return WellRepository.create(well)
        except Exception as e:
            logger.error(f"Error creating well: {str(e)}")
            raise e

    @staticmethod
    def get_well(well_id: UUID | str):
        well = WellRepository.get_by_id(well_id)
        if not well:
            raise ValueError("Well not found")
        return well

    @staticmethod
    def get_all_wells():
        return WellRepository.get_all()

    @staticmethod
    def update_well(well: Well, current_user_id: str):
        try:
            well.last_modified_by = current_user_id
            well.last_modified_date = datetime.now()
            return WellRepository.update(well)
        except Exception as e:
            logger.error(f"Error updating well: {str(e)}")
            raise e

    @staticmethod
    def delete_well(well_id: UUID | str):
        try:
            result = WellRepository.delete(well_id)
            if not result:
                raise ValueError("Well not found")
            return True
        except Exception as e:
            logger.error(f"Error deleting well: {str(e)}")
            raise e
