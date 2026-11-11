import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import UserSession
from ..schemas import GoogleCredentialsConfig
from ..auth import (
    is_authenticated, is_configured, get_credentials, create_oauth_flow,
    save_token, logout as auth_logout, fetch_user_info, save_credentials_file,
    save_code_verifier, get_and_clear_code_verifier
)
from ..config import settings
from ..demo_data import seed_demo_inbox
from ..utils import get_logger

logger = get_logger("auth_routes")
router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/status")
async def get_auth_status(db: AsyncSession = Depends(get_db)):
    authenticated = is_authenticated()
    configured = is_configured()
    user_email = None
    user_name = None
    user_picture = None

    if authenticated:
        creds = get_credentials()
        if creds and creds.token:
            result = await db.execute(select(UserSession).where(UserSession.is_active == True))
            session_rec = result.scalar_one_or_none()
            if session_rec:
                user_email = session_rec.email
                user_name = session_rec.name
                user_picture = session_rec.picture
            else:
                info = await fetch_user_info(creds.token)
                if info and "email" in info:
                    user_email = info.get("email")
                    user_name = info.get("name", "")
                    user_picture = info.get("picture", "")
                    new_session = UserSession(
                        email=user_email,
                        name=user_name,
                        picture=user_picture,
                        is_active=True
                    )
                    db.add(new_session)
                    await db.commit()

    return {
        "is_authenticated": authenticated,
        "is_configured": configured,
        "email": user_email,
        "name": user_name,
        "picture": user_picture,
        "is_demo_mode": settings.DEMO_MODE
    }

@router.get("/login")
async def get_login_url(request: Request):
    if not is_configured():
        raise HTTPException(
            status_code=400,
            detail="Google OAuth credentials are not configured. Please supply client ID and Secret or credentials.json."
        )
    
    flow = create_oauth_flow()
    if not flow:
        raise HTTPException(status_code=500, detail="Failed to initialize OAuth flow")

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )
    if flow.code_verifier:
        save_code_verifier(state, flow.code_verifier)

    return {"url": authorization_url}

@router.get("/callback")
async def oauth_callback(
    code: str,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    flow = create_oauth_flow(state=state)
    if not flow:
        raise HTTPException(status_code=500, detail="Failed to initialize OAuth flow")

    code_verifier = get_and_clear_code_verifier(state)
    if code_verifier:
        flow.code_verifier = code_verifier

    try:
        flow.fetch_token(code=code)
        creds = flow.credentials
        save_token(creds)

        # Retrieve user profile
        if creds.token:
            info = await fetch_user_info(creds.token)
            if info and "email" in info:
                email = info.get("email")
                result = await db.execute(select(UserSession).where(UserSession.email == email))
                existing = result.scalar_one_or_none()
                if not existing:
                    existing = UserSession(email=email)
                    db.add(existing)
                existing.name = info.get("name", "")
                existing.picture = info.get("picture", "")
                existing.is_active = True
                await db.commit()

        # Redirect to frontend root
        return RedirectResponse(url="/")
    except Exception as e:
        logger.exception("OAuth callback failed")
        raise HTTPException(status_code=400, detail=f"Authentication error: {str(e)}")

@router.post("/logout")
async def logout_endpoint(db: AsyncSession = Depends(get_db)):
    auth_logout()
    result = await db.execute(select(UserSession).where(UserSession.is_active == True))
    for sess in result.scalars().all():
        sess.is_active = False
    await db.commit()
    return {"status": "logged_out"}

@router.post("/credentials")
async def set_credentials(config: GoogleCredentialsConfig):
    if not config.client_id or not config.client_secret:
        raise HTTPException(status_code=400, detail="Both Client ID and Client Secret are required")

    data = {
        "web": {
            "client_id": config.client_id.strip(),
            "client_secret": config.client_secret.strip(),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
        }
    }
    if not save_credentials_file(json.dumps(data)):
        raise HTTPException(status_code=500, detail="Failed to store OAuth credentials")

    return {"status": "credentials_saved"}

@router.post("/seed-demo-data")
async def seed_demo_data(db: AsyncSession = Depends(get_db)):
    """
    Populates sample senders and scanned messages for demonstration purposes.
    """
    count = await seed_demo_inbox(db)
    return {"status": "seeded", "count": count}
