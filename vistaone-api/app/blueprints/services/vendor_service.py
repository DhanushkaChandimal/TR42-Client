from app.models.vendor import Vendor
from app.blueprints.enum.enums import VendorStatus, ComplianceStatus
from app.blueprints.repository.vendor_repository import VendorRepository
from app.blueprints.schema.vendor_schema import vendor_schema, vendors_schema


class VendorService:

    @staticmethod
    def get_all_vendors(status=None, compliance=None):
        vendors = VendorRepository.get_all(
            status=status, compliance=compliance
        )
        return vendors_schema.dump(vendors), 200

    @staticmethod
    def get_vendor_by_id(vendor_id):
        vendor = VendorRepository.get_by_id(vendor_id)
        if not vendor:
            return {"message": "Vendor not found"}, 404
        return vendor_schema.dump(vendor), 200

    @staticmethod
    def create_vendor(body, user_id):
        company_name = body.get("company_name", "").strip()
        if not company_name:
            return {"message": "company_name is required"}, 400

        company_email = body.get("company_email", "").strip()
        if not company_email:
            return {"message": "company_email is required"}, 400

        vendor = Vendor(
            name=company_name,
            company_name=company_name,
            company_code=body.get("company_code"),
            primary_contact_name=body.get("primary_contact_name"),
            company_email=company_email,
            company_phone=body.get("company_phone"),
            description=body.get("description"),
            status=VendorStatus.INACTIVE,
            onboarding=True,
            compliance_status=ComplianceStatus.INCOMPLETE,
            created_by=str(user_id),
        )

        saved = VendorRepository.create(vendor)
        return vendor_schema.dump(saved), 201

    @staticmethod
    def update_vendor(vendor_id, body, user_id):
        vendor = VendorRepository.get_by_id(vendor_id)
        if not vendor:
            return {"message": "Vendor not found"}, 404

        updatable = [
            "company_name", "company_code", "primary_contact_name",
            "company_email", "company_phone", "description",
            "vendor_code", "onboarding",
        ]
        for field in updatable:
            if field in body:
                setattr(vendor, field, body[field])

        if "status" in body:
            try:
                vendor.status = VendorStatus(body["status"])
            except ValueError:
                return {"message": f"Invalid status: {body['status']}"}, 400

        if "compliance_status" in body:
            try:
                vendor.compliance_status = ComplianceStatus(body["compliance_status"])
            except ValueError:
                return {"message": f"Invalid compliance_status: {body['compliance_status']}"}, 400

        vendor.last_modified_by = str(user_id)

        saved = VendorRepository.update(vendor)
        return vendor_schema.dump(saved), 200
