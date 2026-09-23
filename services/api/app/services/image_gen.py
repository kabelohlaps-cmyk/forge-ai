"""
Real image generation for design concepts, using Gemini's image model
directly via the google-genai SDK (separate from the langchain_google_genai
text-chat wrapper used for the conversational agents).

Supports two modes:
  - text-to-image: describe a design in words, get a rendered concept image.
  - sketch-to-image: hand it a rough drawing (from the in-app sketch canvas
    or an uploaded photo of paper sketch) plus a text prompt, and it renders
    a refined version that keeps the same composition/pose/proportions.
"""
import base64
import os
import re

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


def data_uri_to_bytes(data_uri: str) -> tuple[bytes, str]:
    """
    Decodes a "data:image/png;base64,...." string (what a browser <canvas>
    or file upload produces) into (raw_bytes, mime_type). Raises ValueError
    if the string isn't a valid data URI.
    """
    match = re.match(r"^data:([\w/+.-]+);base64,(.*)$", data_uri, re.DOTALL)
    if not match:
        raise ValueError("Not a valid data URI")
    mime_type, b64_payload = match.group(1), match.group(2)
    return base64.b64decode(b64_payload), mime_type


async def generate_design_image(
    prompt: str,
    mode: str,
    sketch_bytes: bytes | None = None,
    sketch_mime_type: str = "image/png",
) -> bytes:
    """
    Generates a single image and returns raw PNG bytes. Raises RuntimeError
    with a readable message on failure (missing key, model error, or no
    image in the response) so the router can turn it into a clean 502
    instead of a raw traceback.

    If sketch_bytes is given, the model is asked to refine/render that
    sketch rather than invent a scene from scratch -- this is what powers
    the in-app drawing canvas ("draw with the Gardener" instead of only
    describing things in words).
    """
    client = _get_client()

    if sketch_bytes:
        full_prompt = (
            f"This is a rough sketch for a {mode} design concept. Refine and "
            f"render it as a professional concept illustration, keeping the "
            f"same composition, pose, and proportions the sketch lays out. "
            f"{prompt}. Clean studio lighting, high detail, product/concept-art style."
        )
        contents = [
            types.Part.from_bytes(data=sketch_bytes, mime_type=sketch_mime_type),
            full_prompt,
        ]
    else:
        full_prompt = (
            f"Professional concept illustration for a {mode} design. "
            f"{prompt}. Clean studio lighting, high detail, product/concept-art style."
        )
        contents = full_prompt

    response = client.models.generate_content(
        model=IMAGE_MODEL,
        contents=contents,
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
