from app.models.address import Address
from app.extensions import db
from sqlalchemy.exc import SQLAlchemyError


class AddressRepository:
    @staticmethod
    def get_or_create_address(address_data):
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
            # Create new address if not found
            address = Address(**address_data)
            db.session.add(address)
            db.session.commit()
            return address
        except SQLAlchemyError:
            db.session.rollback()
            raise
