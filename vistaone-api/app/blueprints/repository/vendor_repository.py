from sqlalchemy import select, func, or_, distinct
from sqlalchemy.orm import joinedload
from app.extensions import db
from app.models.vendor import Vendor
from app.models.vendor_service import VendorService
from app.models.service import Service


# Vendor repository - all database queries for the vendor table
# Each method builds and executes a SQLAlchemy query, nothing else
class VendorRepository:

    @staticmethod
    def get_all(status=None, compliance=None):
        """Return all vendors with optional status and compliance filters."""
        query = select(Vendor).options(
            joinedload(Vendor.vendor_services).joinedload(VendorService.service)
        )

        if status:
            query = query.where(Vendor.status == status)

        if compliance:
            query = query.where(Vendor.compliance_status == compliance)

        return db.session.execute(query).unique().scalars().all()

    @staticmethod
    def search(
        q=None,
        service_id=None,
        status=None,
        compliance=None,
        sort_by="company_name",
        order="asc",
        page=1,
        per_page=30,
    ):
        """Paginated marketplace search. Returns
        {items, total, page, per_page, has_more}.

        - `q`           : case-insensitive substring match across name, code,
                          contact, description.
        - `service_id`  : restrict to vendors linked to that service via
                          vendor_service.
        - `sort_by`     : one of company_name, status, compliance_status,
                          created_at. Anything else falls back to company_name.
        """
        page = max(1, int(page or 1))
        per_page = max(1, min(int(per_page or 30), 100))

        base = select(Vendor)
        count_base = select(func.count(distinct(Vendor.id)))

        if service_id:
            base = base.join(VendorService, VendorService.vendor_id == Vendor.id).where(
                VendorService.service_id == service_id
            )
            count_base = count_base.join(
                VendorService, VendorService.vendor_id == Vendor.id
            ).where(VendorService.service_id == service_id)

        if q:
            like = f"%{q.strip().lower()}%"
            term = or_(
                func.lower(Vendor.company_name).like(like),
                func.lower(Vendor.company_code).like(like),
                func.lower(Vendor.primary_contact_name).like(like),
                func.lower(Vendor.description).like(like),
            )
            base = base.where(term)
            count_base = count_base.where(term)

        if status:
            base = base.where(Vendor.status == status)
            count_base = count_base.where(Vendor.status == status)

        if compliance:
            base = base.where(Vendor.compliance_status == compliance)
            count_base = count_base.where(Vendor.compliance_status == compliance)

        sort_columns = {
            "company_name": Vendor.company_name,
            "status": Vendor.status,
            "compliance_status": Vendor.compliance_status,
            "created_at": Vendor.created_at,
        }
        col = sort_columns.get(sort_by, Vendor.company_name)
        col = col.desc() if (order or "").lower() == "desc" else col.asc()

        query = (
            base.options(
                joinedload(Vendor.vendor_services).joinedload(VendorService.service)
            )
            .order_by(col, Vendor.id.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )

        total = db.session.execute(count_base).scalar() or 0
        items = db.session.execute(query).unique().scalars().all()

        return {
            "items": items,
            "total": int(total),
            "page": page,
            "per_page": per_page,
            "has_more": page * per_page < int(total),
        }

    @staticmethod
    def distinct_services():
        """Services that at least one vendor is linked to, ordered by name.
        Used to populate the marketplace service filter dropdown.
        """
        rows = db.session.execute(
            select(Service.id, Service.service)
            .join(VendorService, VendorService.service_id == Service.id)
            .group_by(Service.id, Service.service)
            .order_by(func.lower(Service.service))
        ).all()
        return [{"id": r[0], "service": r[1]} for r in rows]

    @staticmethod
    def get_by_id(vendor_id):
        """Return a single vendor by vendor_id, or None."""
        query = (
            select(Vendor)
            .where(Vendor.id == vendor_id)
            .options(
                joinedload(Vendor.vendor_services).joinedload(VendorService.service)
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
