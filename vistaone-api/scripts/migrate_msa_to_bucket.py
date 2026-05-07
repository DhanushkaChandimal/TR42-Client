"""One-shot migration: push existing local MSA files into Supabase Storage.

Before this PR, MSA file bytes lived only on the local disk of whichever
backend received the upload. After this PR they live in the
"msa-documents" bucket and the local disk acts as a read-through cache.

Usage (from vistaone-api):
    source venv/bin/activate
    python -m scripts.migrate_msa_to_bucket          # dry-run
    python -m scripts.migrate_msa_to_bucket --apply  # actually upload

Idempotent. Files already present in the bucket are skipped. Files in
uploads/msa that have no corresponding msa row are also skipped.
"""
from __future__ import annotations

import sys
from pathlib import Path

from app import create_app
from app.blueprints.services import storage_service
from app.models.msa import Msa


def main():
    apply = "--apply" in sys.argv

    app = create_app()
    with app.app_context():
        if not storage_service.is_configured():
            raise SystemExit(
                "Supabase storage not configured. Set SUPABASE_URL and "
                "SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in "
                "vistaone-api/.env first."
            )

        local_dir = Path(
            __file__
        ).resolve().parent.parent / "uploads" / "msa"
        if not local_dir.exists():
            raise SystemExit(f"Upload dir does not exist: {local_dir}")

        existing = storage_service.list_existing_objects()
        print(f"Bucket already contains {len(existing)} object(s).")

        # Pull every msa row's file_name so we only upload referenced files.
        rows = Msa.query.filter(Msa.file_name.isnot(None)).all()
        referenced = {r.file_name for r in rows if r.file_name}
        print(f"Found {len(referenced)} msa row(s) with a file_name.")

        plan = []
        for fname in sorted(referenced):
            local = local_dir / fname
            if not local.exists() or not local.is_file():
                plan.append((fname, "missing-locally", 0))
                continue
            if fname in existing:
                plan.append((fname, "already-in-bucket", local.stat().st_size))
                continue
            plan.append((fname, "to-upload", local.stat().st_size))

        for fname, status, size in plan:
            print(f"  [{status:18}] {size:>10} bytes  {fname}")

        if not apply:
            print(
                "\nDry run only. Re-run with --apply to upload the "
                "to-upload entries above."
            )
            return

        uploaded = failed = 0
        for fname, status, _size in plan:
            if status != "to-upload":
                continue
            local = local_dir / fname
            data = local.read_bytes()
            ok = storage_service.upload_bytes(fname, data)
            if ok:
                uploaded += 1
                print(f"  uploaded: {fname}")
            else:
                failed += 1
                print(f"  FAILED  : {fname}")
        print(f"\nDone. {uploaded} uploaded, {failed} failed.")


if __name__ == "__main__":
    main()
