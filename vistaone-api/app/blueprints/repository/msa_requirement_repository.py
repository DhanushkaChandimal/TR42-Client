from sqlalchemy import select, delete
from app.extensions import db
from app.models.msa_requirement import MsaRequirement
import logging

logger = logging.getLogger(__name__)


class MsaRequirementRepository:

    @staticmethod
    def get_by_msa(msa_id, category=None, active_only=True):
        """Return rows for an MSA, optionally filtered by category.

        active_only filters by metadata->>is_active = 'true' so callers see
        only the latest analysis run unless they explicitly opt in to history.
        """
        query = select(MsaRequirement).where(MsaRequirement.msa_id == msa_id)
        if category:
            query = query.where(MsaRequirement.category == category)
        if active_only:
            query = query.where(
                MsaRequirement.extra_metadata["is_active"].astext == "true"
            )
        return db.session.execute(query).scalars().all()

    @staticmethod
    def get_active_run_id(msa_id):
        """Return the run_id of the current active analysis for this MSA, or None."""
        query = (
            select(MsaRequirement.extra_metadata["run_id"].astext)
            .where(MsaRequirement.msa_id == msa_id)
            .where(MsaRequirement.extra_metadata["is_active"].astext == "true")
            .limit(1)
        )
        return db.session.execute(query).scalar()

    @staticmethod
    def deactivate_runs(msa_id):
        """Mark every existing row for an MSA as not-active in one statement.

        Used at the start of a new analysis run so the new rows can claim
        is_active=true without leaving stale rows shadowing them.
        """
        rows = (
            db.session.execute(
                select(MsaRequirement).where(MsaRequirement.msa_id == msa_id)
            )
            .scalars()
            .all()
        )
        for row in rows:
            md = dict(row.extra_metadata or {})
            md["is_active"] = False
            row.extra_metadata = md
        return len(rows)

    @staticmethod
    def bulk_create(records):
        try:
            db.session.add_all(records)
            db.session.commit()
            return records
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error bulk-creating msa_requirement rows: {e}")
            raise

    @staticmethod
    def delete_by_msa(msa_id):
        try:
            db.session.execute(
                delete(MsaRequirement).where(MsaRequirement.msa_id == msa_id)
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting msa_requirement rows: {e}")
            raise
