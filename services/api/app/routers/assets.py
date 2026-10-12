from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.services.crypto import encrypt_asset
from app.auth import get_current_user

router = APIRouter(prefix="/assets", tags=["assets"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
_CHUNK = 1024 * 1024


@router.post("/upload")
async def upload_asset(file: UploadFile = File(...), user=Depends(get_current_user)):
    # Read in chunks so an oversized file is rejected without loading all of it.
    chunks, size = [], 0
    while chunk := await file.read(_CHUNK):
        size += len(chunk)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "File is too large (max 25 MB)")
        chunks.append(chunk)
    data = b"".join(chunks)
    enc = encrypt_asset(data)  # no passphrase param anymore -- uses ENCRYPTION_MASTER_KEY + a fresh random salt
    return {"salt": enc["salt"], "iv": enc["iv"], "size": len(data), "encrypted": True}
