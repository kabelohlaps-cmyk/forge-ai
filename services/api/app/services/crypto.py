"""
Asset encryption.

There is no default passphrase. Every deployment must set ENCRYPTION_MASTER_KEY
(a 32-byte key, base64-encoded -- generate with `openssl rand -base64 32`) as a
real secret, never committed to source control. Missing it is a startup error,
not a fallback to a guessable value.

Each asset gets its own random salt, so compromising one asset's derived key
does not help decrypt any other asset, even though they all share the same
master key.
"""
import base64
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def _master_key() -> bytes:
    raw = os.getenv("ENCRYPTION_MASTER_KEY")
    if not raw:
        raise RuntimeError(
            "ENCRYPTION_MASTER_KEY is not set. Generate one with `openssl rand -base64 32` "
            "and set it in your environment -- there is no default."
        )
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise RuntimeError("ENCRYPTION_MASTER_KEY must decode to exactly 32 bytes.")
    return key


def _derive_key(salt: bytes) -> bytes:
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=b"forge-ai-asset-encryption")
    return hkdf.derive(_master_key())


def encrypt_asset(data: bytes) -> dict:
    salt = os.urandom(16)
    iv = os.urandom(12)
    key = _derive_key(salt)
    ciphertext = AESGCM(key).encrypt(iv, data, None)
    return {
        "salt": base64.b64encode(salt).decode(),
        "iv": base64.b64encode(iv).decode(),
        "ciphertext": base64.b64encode(ciphertext).decode(),
    }


def decrypt_asset(salt_b64: str, iv_b64: str, ciphertext_b64: str) -> bytes:
    salt = base64.b64decode(salt_b64)
    iv = base64.b64decode(iv_b64)
    ciphertext = base64.b64decode(ciphertext_b64)
    key = _derive_key(salt)
    return AESGCM(key).decrypt(iv, ciphertext, None)
