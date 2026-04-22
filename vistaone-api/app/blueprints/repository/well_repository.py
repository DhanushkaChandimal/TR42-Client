from uuid import UUID
from sqlalchemy.exc import SQLAlchemyError
from app.models.well import Well
from app.extensions import db


class WellRepository:
    @staticmethod
    def get_all():
        return db.session.query(Well).all()

    @staticmethod
    def get_by_id(well_id: UUID | str):
        try:
            well_uuid = UUID(str(well_id))
        except ValueError:
            return None

        return db.session.query(Well).filter_by(id=well_uuid).first()

    @staticmethod
    def create(well: Well):
        try:
            db.session.add(well)
            db.session.commit()
            return well
        except SQLAlchemyError:
            db.session.rollback()
            raise

    @staticmethod
    def update(well: Well):
        try:
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
