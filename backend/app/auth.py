import json
import os

# Allow oauthlib to accept additional scopes returned by Google (e.g. openid) without throwing ScopeChangeError
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from typing import Optional, Dict, Any
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
import httpx
from .config import settings
from .utils import get_logger

logger = get_logger("auth")

def get_client_config() -> Optional[Dict[str, Any]]:
    # 1. Check if credentials.json exists
    if settings.CREDENTIALS_PATH.exists():
        try:
            with open(settings.CREDENTIALS_PATH, "r") as f:
                data = json.load(f)
                if "web" in data:
                    return data["web"]
                elif "installed" in data:
                    return data["installed"]
                return data
        except Exception:
            pass
            
    # 2. Check if environment variables are provided
    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
        return {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
        }
        
    return None

def is_configured() -> bool:
    return get_client_config() is not None

def _restrict_file_permissions(path) -> None:
    """Restricts secret files to owner-only read/write on POSIX hosts."""
    if os.name == "posix":
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass


def save_credentials_file(content: str) -> bool:
    try:
        data = json.loads(content)
        with open(settings.CREDENTIALS_PATH, "w") as f:
            json.dump(data, f, indent=2)
        _restrict_file_permissions(settings.CREDENTIALS_PATH)
        return True
    except Exception:
        return False

def get_credentials() -> Optional[Credentials]:
    if not settings.TOKEN_PATH.exists():
        return None
        
    try:
        creds = Credentials.from_authorized_user_file(str(settings.TOKEN_PATH), settings.SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(settings.TOKEN_PATH, "w") as token:
                token.write(creds.to_json())
        return creds if creds.valid else None
    except Exception as e:
        logger.error("Error loading credentials: %s", e)
        return None

def is_authenticated() -> bool:
    return get_credentials() is not None

STATE_FILE = settings.DATA_PATH / "oauth_state.json"

def save_code_verifier(state: str, code_verifier: Optional[str]):
    if not state or not code_verifier:
        return
    try:
        data = {}
        if STATE_FILE.exists():
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
        data[state] = code_verifier
        with open(STATE_FILE, "w") as f:
            json.dump(data, f)
        _restrict_file_permissions(STATE_FILE)
    except Exception as e:
        logger.warning("Error saving code verifier: %s", e)

def get_and_clear_code_verifier(state: Optional[str]) -> Optional[str]:
    try:
        if not STATE_FILE.exists():
            return None
        with open(STATE_FILE, "r") as f:
            data = json.load(f)
        verifier = None
        if state and state in data:
            verifier = data.pop(state)
        elif data:
            # Fallback to the latest verifier if state matching is loose
            key = list(data.keys())[-1]
            verifier = data.pop(key)
        with open(STATE_FILE, "w") as f:
            json.dump(data, f)
        return verifier
    except Exception as e:
        logger.warning("Error reading code verifier: %s", e)
        return None

def create_oauth_flow(state: Optional[str] = None, redirect_uri: Optional[str] = None) -> Optional[Flow]:
    config = get_client_config()
    if not config:
        return None
        
    client_config = {
        "web": {
            "client_id": config.get("client_id"),
            "client_secret": config.get("client_secret"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri or settings.GOOGLE_REDIRECT_URI]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=settings.SCOPES,
        state=state,
        redirect_uri=redirect_uri or settings.GOOGLE_REDIRECT_URI
    )
    return flow

async def fetch_user_info(access_token: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if resp.status_code == 200:
            return resp.json()
    return {}

def save_token(creds: Credentials):
    with open(settings.TOKEN_PATH, "w") as token:
        token.write(creds.to_json())
    _restrict_file_permissions(settings.TOKEN_PATH)

def logout():
    if settings.TOKEN_PATH.exists():
        try:
            settings.TOKEN_PATH.unlink()
        except Exception:
            pass
