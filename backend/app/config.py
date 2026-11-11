from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    APP_NAME: str = "Gmail Cleaner"
    DEBUG: bool = False
    PORT: int = 8000
    HOST: str = "127.0.0.1"
    CORS_ORIGINS: list[str] = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Persistent Paths
    DATA_PATH: Path = DATA_DIR
    DB_URL: str = f"sqlite+aiosqlite:///{DATA_DIR / 'cleaner.db'}"
    TOKEN_PATH: Path = DATA_DIR / "token.json"
    CREDENTIALS_PATH: Path = DATA_DIR / "credentials.json"

    # Google OAuth2 Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback"

    # Scopes needed for bulk scanning, modifying labels, trashing, permanent delete, and unsubscribe mailto
    SCOPES: list[str] = [
        "openid",
        "https://mail.google.com/",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]

    # Demo mode allows testing the app UI and flows with simulated data if credentials are not yet configured
    DEMO_MODE: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
