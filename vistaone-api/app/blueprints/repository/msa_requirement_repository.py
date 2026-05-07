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
        """Mark every existing AI row for an MSA as not-active in one
        statement. Used at the start of a new analysis run so the new
        rows can claim is_active=true without leaving stale rows
        shadowing them.

        User notes (category='user_note') are intentionally skipped so
        re-running the AI analysis never wipes out team-authored notes.
        """
        rows = (
            db.session.execute(
                select(MsaRequirement).where(MsaRequirement.msa_id == msa_id)
            )
            .scalars()
            .all()
        )
        touched = 0
        for row in rows:
            if row.category == "user_note":
                continue
            md = dict(row.extra_metadata or {})
            md["is_active"] = False
            row.extra_metadata = md
            touched += 1
        return touched

    @staticmethod
    def add_note(msa_id, body, user_id):
        """Insert a user-authored note for an MSA. Stored as a
        msa_requirement row with category='user_note' so we don't need a
        new table; created_by carries the author and created_at the time.
        """
        note = MsaRequirement(
            msa_id=msa_id,
            category="user_note",
            rule_type="note",
            description=body,
            extra_metadata={"is_active": True, "type": "user_note"},
            created_by=str(user_id),
            updated_by=str(user_id),
        )
        try:
            db.session.add(note)
            db.session.commit()
            db.session.refresh(note)
            return note
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error inserting msa user_note: {e}")
            raise

    @staticmethod
    def get_notes(msa_id):
        """Return all user notes for an MSA, newest first. Notes are not
        run-versioned (no is_active gate) so every team note remains
        visible across analysis re-runs."""
        return (
            db.session.execute(
                select(MsaRequirement)
                .where(MsaRequirement.msa_id == msa_id)
                .where(MsaRequirement.category == "user_note")
                .order_by(MsaRequirement.created_at.desc())
            )
            .scalars()
            .all()
        )

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
