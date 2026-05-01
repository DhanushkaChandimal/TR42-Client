"""
One-shot migration to create the msa_requirement table per the ERD.

The table is defined in the DBML schema but did not yet exist in the live
Postgres. This script creates it from the SQLAlchemy model so the AI MSA
analyst feature can persist extracted facts (executive summary, key terms,
risks, red flags, action items, pricing) without requiring db.create_all().

Idempotent: re-running after a successful create is a no-op.

Run from vistaone-api/ with the same env the app uses:
    FLASK_CONFIG=DevelopmentConfig python scripts/create_msa_requirement_table.py
"""
import os
import sys

from sqlalchemy import inspect

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models.msa_requirement import MsaRequirement  # noqa: E402


def main():
    config_name = os.getenv("FLASK_CONFIG", "DevelopmentConfig")
    app = create_app(config_name)
    with app.app_context():
        insp = inspect(db.engine)
        if "msa_requirement" in insp.get_table_names():
            print("msa_requirement already exists; nothing to do.")
            return
        MsaRequirement.__table__.create(db.engine)
        print("Created msa_requirement table.")


if __name__ == "__main__":
    main()
