from uuid import UUID
from app.models.wells import Well
from app.blueprints.repository.well_repository import WellRepository
from app.extensions import db
import logging
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

logger = logging.getLogger(__name__)


class WellService:
    @staticmethod
    def create_well(validated_well_data: dict, current_user_id: str):
        try:
            well_data = validated_well_data.copy()
            well_data["created_by"] = current_user_id
            well_data["created_date"] = datetime.now()
            well = WellRepository.create(well_data)
            return well
        except Exception as e:
            logger.error(f"Error creating well: {str(e)}")
            db.session.rollback()
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
    def update_well(well_id: UUID | str, data: dict, current_user_id: str):
        try:
            well = WellRepository.get_by_id(well_id)
            if not well:
                raise ValueError("Well not found")
            for key, value in data.items():
                if hasattr(well, key):
                    setattr(well, key, value)
            well.last_modified_by = current_user_id
            well.last_modified_date = datetime.now()
            db.session.commit()
            return well
        except Exception as e:
            logger.error(f"Error updating well: {str(e)}")
            db.session.rollback()
            raise e

    @staticmethod
    def delete_well(well_id: UUID | str):
        try:
            well = WellRepository.get_by_id(well_id)
            if not well:
                raise ValueError("Well not found")
            db.session.delete(well)
            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Error deleting well: {str(e)}")
            db.session.rollback()
            raise e
