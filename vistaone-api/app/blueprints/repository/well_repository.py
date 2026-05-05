from uuid import UUID
from sqlalchemy.exc import SQLAlchemyError
from app.models.well import Well
from app.extensions import db


class WellRepository:
    @staticmethod
    def get_all(client_id=None):
        query = db.session.query(Well)
        if client_id:
            query = query.filter(Well.client_id == client_id)
        return query.all()

    @staticmethod
    def get_by_id(well_id: UUID | str, client_id=None):
        try:
            UUID(str(well_id))
        except ValueError:
            return None

        query = db.session.query(Well).filter_by(id=str(well_id))
        if client_id:
            query = query.filter(Well.client_id == client_id)
        return query.first()

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
    def delete(well_id: UUID | str, client_id=None):
        try:
            well = WellRepository.get_by_id(well_id, client_id=client_id)
            if not well:
                return False

            db.session.delete(well)
            db.session.commit()
            return True

        except SQLAlchemyError:
            db.session.rollback()
            raise
