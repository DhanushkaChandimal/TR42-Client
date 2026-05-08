import os
from dotenv import load_dotenv
from sqlalchemy.pool import NullPool

load_dotenv()

# Supabase's session-mode pooler caps clients at pool_size=15. The default
# Flask-SQLAlchemy QueuePool (size=5 + overflow=10 = 15) lines up with that
# limit exactly, so any leaked or idle connection tips the app into
# `EMAXCONNSESSION: max clients reached` and every subsequent request 500s.
# NullPool opens/closes per request and lets pgbouncer do the pooling — the
# documented Supabase recommendation.
SHARED_ENGINE_OPTIONS = {
    "poolclass": NullPool,
    "pool_pre_ping": True,
}


class DevelopmentConfig:
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI")
    SQLALCHEMY_ENGINE_OPTIONS = SHARED_ENGINE_OPTIONS
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    CACHE_TYPE = "SimpleCache"
    CACHE_DEFAULT_TIMEOUT = 300
    FRONTEND_URL = "http://localhost:5173"
    MAIL_SERVER = os.getenv("MAIL_SERVER")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "True").lower() in ("true", "1", "yes")
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER")
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    OLLAMA_TIMEOUT_S = int(os.getenv("OLLAMA_TIMEOUT_S", "180"))
    AI_PROMPT_VERSION = os.getenv("AI_PROMPT_VERSION", "v3")
    AI_MAX_INPUT_CHARS = int(os.getenv("AI_MAX_INPUT_CHARS", "200000"))


class TestingConfig:
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    TESTING = True
    DEBUG = True
    CACHE_TYPE = "SimpleCache"
    FRONTEND_URL = "http://localhost:5173"
    SECRET_KEY = "test-secret-key"
    LLM_PROVIDER = "ollama"
    OLLAMA_BASE_URL = "http://localhost:11434"
    OLLAMA_MODEL = "llama3.1:8b"
    OLLAMA_TIMEOUT_S = 30
    AI_PROMPT_VERSION = "test"
    AI_MAX_INPUT_CHARS = 50000


class ProductionConfig:
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get("SQLALCHEMY_DATABASE_URI")
    SQLALCHEMY_ENGINE_OPTIONS = SHARED_ENGINE_OPTIONS
    SECRET_KEY = os.environ.get("SECRET_KEY")
    CACHE_TYPE = "SimpleCache"
    FRONTEND_URL = "https://client-web-dashboard.vercel.app"
    MAIL_SERVER = os.environ.get("MAIL_SERVER")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "True").lower() in (
        "true",
        "1",
        "yes",
    )
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER")
    LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama")
    OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")
    OLLAMA_TIMEOUT_S = int(os.environ.get("OLLAMA_TIMEOUT_S", "180"))
    AI_PROMPT_VERSION = os.environ.get("AI_PROMPT_VERSION", "v3")
    AI_MAX_INPUT_CHARS = int(os.environ.get("AI_MAX_INPUT_CHARS", "200000"))
