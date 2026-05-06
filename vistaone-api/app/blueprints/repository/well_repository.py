from uuid import UUID
from sqlalchemy import or_, cast, String, desc, asc
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
    def search(
        search_text=None,
        status=None,
        page=1,
        per_page=10,
        sort_by="created_at",
        order="desc",
        client_id=None,
    ):
        try:
            query = Well.query
            if client_id:
                query = query.filter(Well.client_id == client_id)
            if status:
                query = query.filter(Well.status == status)
            if search_text:
                for word in search_text.lower().split():
                    pattern = f"%{word}%"
                    query = query.filter(
                        or_(
                            Well.api_number.ilike(pattern),
                            Well.well_name.ilike(pattern),
                            cast(Well.status, String).ilike(pattern),
                            cast(Well.type, String).ilike(pattern),
                        )
                    )
            sort_column = getattr(Well, sort_by, Well.created_at)
            query = query.order_by(desc(sort_column) if order.lower() == "desc" else asc(sort_column))
            return query.paginate(page=page, per_page=per_page, error_out=False)
        except Exception as e:
            raise Exception(f"Error during well search: {str(e)}")

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
