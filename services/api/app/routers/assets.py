from fastapi import APIRouter, UploadFile, File, Depends
from app.services.crypto import encrypt_asset
from app.auth import get_current_user

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("/upload")
async def upload_asset(file: UploadFile = File(...), user=Depends(get_current_user)):
    data = await file.read()
    enc = encrypt_asset(data)  # no passphrase param anymore -- uses ENCRYPTION_MASTER_KEY + a fresh random salt
    return {"salt": enc["salt"], "iv": enc["iv"], "size": len(data), "encrypted": True}
