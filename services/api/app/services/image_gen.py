"""
Real image generation for design concepts, using Gemini's image model
directly via the google-genai SDK (separate from the langchain_google_genai
text-chat wrapper used for the conversational agents).
"""
import base64
import os

from google import genai
from google.genai import types

IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _client = genai.Client(api_key=api_key)
    return _client


async def generate_design_image(prompt: str, mode: str) -> bytes:
    """
    Generates a single image from a text description and returns raw PNG
    bytes. Raises RuntimeError with a readable message on failure (missing
    key, model error, or no image in the response) so the router can turn
    it into a clean 502 instead of a raw traceback.
    """
    client = _get_client()
    full_prompt = (
        f"Professional concept illustration for a {mode} design. "
        f"{prompt}. Clean studio lighting, high detail, product/concept-art style."
    )
    response = client.models.generate_content(
        model=IMAGE_MODEL,
        contents=full_prompt,
        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
    )

    if not response.candidates:
        raise RuntimeError("No candidates returned from image model")

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return part.inline_data.data

    raise RuntimeError("Image model response contained no image data")


def bytes_to_data_uri(image_bytes: bytes, mime_type: str = "image/png") -> str:
    b64 = base64.b64encode(image_bytes).decode()
    return f"data:{mime_type};base64,{b64}"
