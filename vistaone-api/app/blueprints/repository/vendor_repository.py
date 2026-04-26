from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.extensions import db
from app.models.vendor import Vendor
from app.models.vendor_service import VendorService


# Vendor repository - all database queries for the vendor table
# Each method builds and executes a SQLAlchemy query, nothing else
class VendorRepository:

    @staticmethod
    def get_all(status=None, compliance=None):
        """Return all vendors with optional status and compliance filters."""
        query = select(Vendor).options(
            joinedload(Vendor.vendor_services).joinedload(VendorService.service_type)
        )

        if status:
            query = query.where(Vendor.status == status)

        if compliance:
            query = query.where(Vendor.compliance_status == compliance)

        return db.session.execute(query).unique().scalars().all()

    @staticmethod
    def get_by_id(vendor_id):
        """Return a single vendor by vendor_id, or None."""
        query = (
            select(Vendor)
            .where(Vendor.id == vendor_id)
            .options(
                joinedload(Vendor.vendor_services).joinedload(
                    VendorService.service_type
                )
            )
        )
        return db.session.execute(query).unique().scalars().first()

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
