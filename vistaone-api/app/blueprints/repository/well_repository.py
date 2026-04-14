from uuid import UUID
from sqlalchemy.exc import SQLAlchemyError
from app.models.wells import Well
from app.extensions import db


class WellRepository:
    @staticmethod
    def get_all():
        return Well.query.all()

    @staticmethod
    def get_by_id(well_id: UUID | str):
        try:
            well_uuid = UUID(str(well_id))
        except ValueError:
            return None

        return Well.query.filter_by(well_id=well_uuid).first()

    @staticmethod
    def create(data: dict):
        try:
            well = Well(**data)
            db.session.add(well)
            db.session.commit()
            return well
        except SQLAlchemyError:
            db.session.rollback()
            raise

    @staticmethod
    def update(well_id: UUID | str, data: dict):
        try:
            well = WellRepository.get_by_id(well_id)
            if not well:
                return None

            for key, value in data.items():
                if hasattr(well, key):
                    setattr(well, key, value)

            db.session.commit()
            return well

        except SQLAlchemyError:
            db.session.rollback()
            raise

    @staticmethod
    def delete(well_id: UUID | str):
        try:
            well = WellRepository.get_by_id(well_id)
            if not well:
                return False

            db.session.delete(well)
            db.session.commit()
            return True

        except SQLAlchemyError:
            db.session.rollback()
            raise
