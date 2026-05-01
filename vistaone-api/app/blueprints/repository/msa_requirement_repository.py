from sqlalchemy import select, delete
from app.extensions import db
from app.models.msa_requirement import MsaRequirement
import logging

logger = logging.getLogger(__name__)


class MsaRequirementRepository:

    @staticmethod
    def get_by_msa(msa_id, category=None, active_only=True):
        """Return rows for an MSA, optionally filtered by category.

        active_only keeps only rows whose metadata.is_active is True so callers
        see only the latest analysis run unless they opt in to history. The
        is_active filter runs in Python because the metadata column is plain
        JSON (not JSONB), which doesn't support the ->>  text-extract operator
        used by SQLAlchemy's .astext.
        """
        query = select(MsaRequirement).where(MsaRequirement.msa_id == msa_id)
        if category:
            query = query.where(MsaRequirement.category == category)
        rows = db.session.execute(query).scalars().all()
        if active_only:
            rows = [r for r in rows if (r.extra_metadata or {}).get("is_active") is True]
        return rows

    @staticmethod
    def get_active_run_id(msa_id):
        """Return the run_id of the current active analysis for this MSA, or None."""
        rows = MsaRequirementRepository.get_by_msa(msa_id, active_only=True)
        for r in rows:
            run_id = (r.extra_metadata or {}).get("run_id")
            if run_id:
                return run_id
        return None

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
