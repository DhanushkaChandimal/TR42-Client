from sqlalchemy import select
from app.extensions import db
from app.models.clientapp_model import Vendor


# Vendor repository - all database queries for the vendor table
# Each method builds and executes a SQLAlchemy query, nothing else
class VendorRepository:

    @staticmethod
    def get_all(status=None, compliance=None):
        """Return all vendors with optional status and compliance filters."""
        query = select(Vendor)

        if status:
            query = query.where(Vendor.status == status)

        if compliance:
            query = query.where(Vendor.compliance_status == compliance)

        return db.session.execute(query).scalars().all()

    @staticmethod
    def get_by_id(vendor_id):
        """Return a single vendor by vendor_id, or None."""
        query = select(Vendor).where(Vendor.vendor_id == vendor_id)
        return db.session.execute(query).scalars().first()

    @staticmethod
    def create(vendor):
        """Persist a new Vendor instance and return it."""
        db.session.add(vendor)
        db.session.commit()
        db.session.refresh(vendor)
        return vendor

    @staticmethod
    def update(vendor):
        """Commit changes to an existing Vendor and return it."""
        db.session.commit()
        db.session.refresh(vendor)
        return vendor
