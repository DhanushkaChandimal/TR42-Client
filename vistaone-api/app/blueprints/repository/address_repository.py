from app.models.address import Address
from app.extensions import db
from sqlalchemy.exc import SQLAlchemyError


class AddressRepository:
    @staticmethod
    def get_or_create_address(address_data, user_id=None):
        # Try to find an existing address with all fields matching
        try:
            address = (
                db.session.query(Address)
                .filter_by(
                    street=address_data["street"],
                    city=address_data["city"],
                    state=address_data["state"],
                    zip=address_data["zip"],
                    country=address_data["country"],
                )
                .first()
            )
            if address:
                return address
            # Create new address if not found. created_by/updated_by are NOT NULL
            # FKs to auth_user; pass the acting user when no JWT actor is set
            # (e.g. during client self-registration before the admin user exists).
            address = Address(**address_data)
            if user_id:
                address.created_by = user_id
                address.updated_by = user_id
            db.session.add(address)
            db.session.flush()
            return address
        except SQLAlchemyError:
            db.session.rollback()
            raise
