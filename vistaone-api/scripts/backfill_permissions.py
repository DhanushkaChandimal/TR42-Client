"""Backfill Permission rows for the 3 newly-gated resources.

Before this PR, the sidebar exposed Analytics, Fraud, and Messages without
distinct permission keys (Analytics + Fraud were ungated; Messages reused
the workorders key). After this PR each gets its own resource string, so
non-MASTER roles need explicit Permission rows or those users lose
sidebar visibility on the next login.

This script is idempotent: it only inserts missing rows. Existing rows
are not touched. MASTER is skipped because the auth layer bypasses
permission checks for MASTER.

Usage:
    cd vistaone-api
    source venv/bin/activate
    python -m scripts.backfill_permissions <client-name>
    # e.g. python -m scripts.backfill_permissions Tucker-Sosa

Defaults applied to missing rows:
    ADMIN role:
        analytics, fraud, messages -> can_read=True, can_write=True
    USER role:
        messages -> can_read=True (preserves prior behavior since
                    messages was tied to the workorders key)
        analytics, fraud -> all flags False (admin must grant)

Custom (non-built-in) roles are left alone so we don't override
deliberate configuration.
"""
from __future__ import annotations

import sys

from app import create_app
from app.extensions import db
from app.models.client import Client
from app.models.role import Role
from app.models.permission import Permission


NEW_RESOURCES = ("analytics", "fraud", "messages")
BUILT_IN_NON_MASTER = {"ADMIN", "USER"}


# Per-role default flags for the three new resources
DEFAULTS = {
    "ADMIN": {
        "analytics": (True, True, False),
        "fraud":     (True, True, False),
        "messages":  (True, True, False),
    },
    "USER": {
        "analytics": (False, False, False),
        "fraud":     (False, False, False),
        "messages":  (True, False, False),
    },
}


def backfill_for_client(client_name: str) -> dict:
    client = Client.query.filter(Client.client_name == client_name).first()
    if not client:
        raise SystemExit(f"Client '{client_name}' not found")

    roles = Role.query.filter(Role.client_id == client.id).all()
    if not roles:
        return {"client": client_name, "roles_seen": 0, "inserted": 0}

    inserted = 0
    skipped_existing = 0
    skipped_role = 0
    for role in roles:
        name = (role.name or "").upper()
        if name not in BUILT_IN_NON_MASTER:
            skipped_role += 1
            continue
        defaults = DEFAULTS[name]
        for resource in NEW_RESOURCES:
            existing = Permission.query.filter_by(
                role_id=role.id, resource=resource,
            ).first()
            if existing is not None:
                skipped_existing += 1
                continue
            r, w, d = defaults[resource]
            db.session.add(
                Permission(
                    role_id=role.id,
                    resource=resource,
                    can_read=r,
                    can_write=w,
                    can_delete=d,
                )
            )
            inserted += 1
    db.session.commit()
    return {
        "client": client_name,
        "client_id": client.id,
        "roles_seen": len(roles),
        "inserted": inserted,
        "skipped_existing": skipped_existing,
        "skipped_non_builtin": skipped_role,
    }


def main():
    if len(sys.argv) != 2:
        print(
            "Usage: python -m scripts.backfill_permissions <client-name>",
            file=sys.stderr,
        )
        raise SystemExit(2)

    client_name = sys.argv[1]
    app = create_app()
    with app.app_context():
        result = backfill_for_client(client_name)
    for k, v in result.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
