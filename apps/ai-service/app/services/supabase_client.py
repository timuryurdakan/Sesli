import os
from functools import lru_cache

from supabase import Client, create_client

STORAGE_BUCKET = "tracks"


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Lazily builds the service-role Supabase client so the app can boot
    without credentials (matches the lazy-init pattern used in apps/api's
    SupabaseService — see docs/handoffs/stage-02.md)."""
    url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not service_role_key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured")

    return create_client(url, service_role_key)


def download_from_storage(supabase: Client, storage_path: str) -> bytes:
    result: bytes = supabase.storage.from_(STORAGE_BUCKET).download(storage_path)
    return result


def upload_to_storage(supabase: Client, dest: str, data: bytes) -> None:
    supabase.storage.from_(STORAGE_BUCKET).upload(dest, data, {"content-type": "audio/wav"})
