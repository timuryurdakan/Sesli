import os

import pytest

TEST_INTERNAL_KEY = "test-internal-key"


@pytest.fixture(autouse=True, scope="session")
def _internal_service_key() -> None:
    """Router tests exercise endpoints now protected by
    app.security.verify_internal_key (Stage 10 security audit, Ajan 12
    Kritik #1) — provide a stable shared secret so those tests don't need
    real inter-service configuration."""
    os.environ["AI_SERVICE_INTERNAL_KEY"] = TEST_INTERNAL_KEY
