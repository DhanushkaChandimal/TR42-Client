"""Supabase Storage backing for MSA contract files.

Files used to live on the local disk of whichever backend received the
upload, which broke any multi-user demo where teammates run their own
Flask backends. They'd see the DB row but Download / AI Analyze /
Invoice Review would all 404 because the file bytes never crossed
machines.

This service writes uploaded MSA files to a Supabase Storage bucket
(default name: "msa-documents") and treats local disk as a one-way
read-through cache: when any consumer needs the bytes (download, text
extraction, table parsing), it calls ensure_local() which downloads
from the bucket if the file isn't already cached locally.

DB schema doesn't change: msa.file_name keeps holding the same string
it always did (a uuid-prefixed basename). It now doubles as the bucket
object key.

If SUPABASE_URL or SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) is
missing, every method falls through to local-disk-only behavior so
local dev keeps working without the env vars set.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# UPLOAD_DIR = the same on-disk cache we already wrote to. Living next
# to msa_service.UPLOAD_DIR for backwards compat; importing it here
# would cause a circular import, so we re-derive the path.
_LOCAL_DIR = Path(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "msa")
).resolve()


def _bucket_name() -> str:
    return os.environ.get("SUPABASE_BUCKET", "msa-documents")


def _client():
    """Return a configured Supabase client, or None if env vars missing.

    Prefers SUPABASE_SERVICE_ROLE_KEY (bypasses RLS, what a backend
    really wants) but falls back to SUPABASE_ANON_KEY if that's all
    that's available - relies on the bucket having permissive RLS in
    that case.
    """
    url = os.environ.get("SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
    )
    if not url or not key:
        return None
    try:
        from supabase import create_client  # imported lazily so the dep
        # is only required when storage is actually configured

        return create_client(url, key)
    except Exception as e:  # pragma: no cover
        logger.warning(f"Supabase client init failed: {e}")
        return None


def is_configured() -> bool:
    return _client() is not None


def upload_bytes(filename: str, data: bytes, content_type: str = None) -> bool:
    """Upload bytes to the bucket under the given object key. Returns
    True on success, False if storage isn't configured or the call
    fails. Always also writes to the local cache so subsequent reads
    on the same machine don't have to round-trip to the bucket.
    """
    _LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    local = _LOCAL_DIR / filename
    try:
        local.write_bytes(data)
    except OSError as e:
        logger.warning(f"Local cache write failed for {filename}: {e}")

    client = _client()
    if not client:
        return False
    try:
        opts = {"upsert": "true"}
        if content_type:
            opts["content-type"] = content_type
        client.storage.from_(_bucket_name()).upload(filename, data, opts)
        return True
    except Exception as e:
        logger.warning(f"Supabase upload failed for {filename}: {e}")
        return False


def download_bytes(filename: str) -> bytes:
    """Pull the object from the bucket. Raises on failure."""
    client = _client()
    if not client:
        raise FileNotFoundError(
            f"Supabase storage not configured; cannot fetch {filename}"
        )
    return client.storage.from_(_bucket_name()).download(filename)


def ensure_local(filename: str) -> Path:
    """Return a path to the file on local disk, downloading from the
    bucket on first miss. Raises FileNotFoundError if neither cache
    nor bucket has it.
    """
    local = _LOCAL_DIR / filename
    if local.exists() and local.is_file() and local.stat().st_size > 0:
        return local
    # Cache miss — pull from bucket.
    try:
        data = download_bytes(filename)
    except Exception as e:
        raise FileNotFoundError(
            f"File {filename} missing locally and could not be fetched "
            f"from bucket: {e}"
        )
    _LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    local.write_bytes(data)
    return local


def list_existing_objects() -> set[str]:
    """Return the set of filenames already in the bucket. Used by the
    one-shot migration to skip re-uploading files."""
    client = _client()
    if not client:
        return set()
    try:
        rows = client.storage.from_(_bucket_name()).list()
        return {r.get("name") for r in rows if r.get("name")}
    except Exception as e:
        logger.warning(f"Supabase list failed: {e}")
        return set()
