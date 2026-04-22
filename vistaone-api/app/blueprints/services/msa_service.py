import os
import uuid
from werkzeug.utils import secure_filename
from app.models.msa import Msa
from app.blueprints.repository.msa_repository import MsaRepository
from app.blueprints.schema.msa_schema import msa_schema, msas_schema
import logging

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "msa")


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


class MsaService:

    @staticmethod
    def get_all(vendor_id=None, status=None):
        records = MsaRepository.get_all(vendor_id=vendor_id, status=status)
        results = []
        for m in records:
            data = msa_schema.dump(m)
            data["vendor_name"] = MsaRepository.get_vendor_name(m.vendor_id)
            data["uploaded_by_name"] = MsaRepository.get_uploader_name(m.uploaded_by)
            results.append(data)
        return results, 200

    @staticmethod
    def get_by_id(msa_id):
        record = MsaRepository.get_by_id(msa_id)
        if not record:
            return {"message": "MSA not found"}, 404
        data = msa_schema.dump(record)
        data["vendor_name"] = MsaRepository.get_vendor_name(record.vendor_id)
        data["uploaded_by_name"] = MsaRepository.get_uploader_name(record.uploaded_by)
        return data, 200

    @staticmethod
    def upload_msa(form_data, file, user_id):
        vendor_id = form_data.get("vendor_id", "").strip()
        if not vendor_id:
            return {"message": "vendor_id is required"}, 400
        version = form_data.get("version", "").strip()
        if not version:
            return {"message": "version is required"}, 400
        if not file or file.filename == "":
            return {"message": "A file is required"}, 400
        allowed_extensions = (".pdf", ".doc", ".docx")
        if not file.filename.lower().endswith(allowed_extensions):
            return {"message": "Only PDF and Word documents are allowed"}, 400

        ensure_upload_dir()
        safe_name = secure_filename(file.filename)
        unique_name = f"{str(uuid.uuid4())}_{safe_name}"
        save_path = os.path.join(UPLOAD_DIR, unique_name)
        file.save(save_path)

        msa = Msa(
            vendor_id=vendor_id,
            version=version,
            effective_date=form_data.get("effective_date") or None,
            expiration_date=form_data.get("expiration_date") or None,
            status="active",
            uploaded_by=str(user_id),
            file_name=unique_name,
            created_by=str(user_id),
        )
        saved = MsaRepository.create(msa)
        logger.info(f"MSA uploaded: {saved.id}")
        data = msa_schema.dump(saved)
        data["vendor_name"] = MsaRepository.get_vendor_name(saved.vendor_id)
        data["uploaded_by_name"] = MsaRepository.get_uploader_name(saved.uploaded_by)
        return data, 201

    @staticmethod
    def update_msa(msa_id, body, user_id):
        record = MsaRepository.get_by_id(msa_id)
        if not record:
            return {"message": "MSA not found"}, 404
        for field in ["version", "effective_date", "expiration_date", "status"]:
            if field in body:
                setattr(record, field, body[field])
        valid_statuses = {"active", "expired", "incomplete", "pending"}
        if record.status not in valid_statuses:
            return {"message": f"Invalid status. Choose from: {', '.join(valid_statuses)}"}, 400
        record.last_modified_by = str(user_id)
        saved = MsaRepository.update(record)
        logger.info(f"MSA updated: {saved.id}")
        data = msa_schema.dump(saved)
        data["vendor_name"] = MsaRepository.get_vendor_name(saved.vendor_id)
        data["uploaded_by_name"] = MsaRepository.get_uploader_name(saved.uploaded_by)
        return data, 200
