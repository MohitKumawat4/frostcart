"""Google Cloud Function for analyzing product images with Gemini 2.5 Flash.

The function can be triggered with either a Supabase `product_images` row id or a raw
image URL. When the Supabase id path is used the generated AI metadata is persisted
back to the originating row. All paths return the AI generated description payload
without mutating any other fields.
"""

import datetime
import json
import os
from typing import Any, Dict, Optional

import functions_framework
import requests
from google import genai
from google.genai import types as genai_types
from postgrest import APIError
from supabase import Client, create_client

# Lazily instantiated singletons to keep cold-starts minimal.
_supabase_client: Optional[Client] = None
_gemini_client: Optional[genai.Client] = None


def _get_supabase_client() -> Client:
    """Create (once) and return the Supabase client using service role credentials."""
    global _supabase_client

    if _supabase_client is None:
        supabase_url = os.environ["SUPABASE_URL"]
        service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _supabase_client = create_client(supabase_url, service_role_key)

    return _supabase_client


def _get_gemini_client() -> genai.Client:
    """Create (once) and return the Gemini SDK client."""
    global _gemini_client

    if _gemini_client is None:
        api_key = os.environ["GEMINI_API_KEY"]
        _gemini_client = genai.Client(api_key=api_key)

    return _gemini_client


def _fetch_product_image_record(image_id: str) -> Dict[str, Any]:
    """Lookup a single `product_images` row from Supabase."""
    client = _get_supabase_client()
    response = (
        client.table("product_images")
        .select("*")
        .eq("id", image_id)
        .single()
        .execute()
    )

    if not response.data:
        raise ValueError(f"No product_images row found for id '{image_id}'")

    return response.data


def _select_image_url(record: Dict[str, Any]) -> str:
    """Derive the preferred image URL following thumbnail → primary → first image."""
    thumbnail_url = record.get("thumbnail_url")
    if thumbnail_url:
        return thumbnail_url

    primary_image_url = record.get("primary_image_url")
    if primary_image_url:
        return primary_image_url

    image_urls = record.get("image_urls") or []
    if image_urls:
        return image_urls[0]

    raise ValueError("No usable image URL found in product_images record")


def _download_image(image_url: str) -> bytes:
    """Fetch the binary contents of an image URL."""
    response = requests.get(image_url, timeout=20)
    response.raise_for_status()
    return response.content


def _call_gemini(image_bytes: bytes, model_id: str) -> Dict[str, Any]:
    """Send the image to Gemini 2.5 Flash and parse the structured JSON output."""
    client = _get_gemini_client()

    contents = [
        genai_types.Content(
            role="user",
            parts=[
                genai_types.Part.from_text(
                    text=(
                        "You are assisting an ice-cream marketplace. Analyze this product photo "
                        "and provide: \n"
                        "1. A concise product title (<= 12 words).\n"
                        "2. Likely product category (ice cream, sorbet, frozen dessert, gelato, "
                        "popsicle, other).\n"
                        "3. Estimated price in INR (integer).\n"
                        "4. Tasting description (40-60 words).\n"
                        "Return JSON with keys: title, category, price_inr, description."
                    )
                ),
                genai_types.Part.from_bytes(
                    data=image_bytes,
                    mime_type="image/jpeg",
                ),
            ],
        )
    ]

    response = client.models.generate_content(
        model=model_id,
        contents=contents,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.35,
            top_p=0.8,
            top_k=32,
        ),
    )

    if not response.candidates:
        raise RuntimeError("Gemini returned no candidates")

    # Gemini returns zero or more parts; use the first text part that parses as JSON.
    candidate = response.candidates[0]
    for part in candidate.content.parts:
        if part.text:
            try:
                return json.loads(part.text)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Gemini response is not valid JSON: {part.text}") from exc

    raise RuntimeError("Gemini candidate had no textual JSON content")


def _update_ai_metadata(image_id: str, metadata: Dict[str, Any]) -> None:
    """Persist the AI metadata back onto the originating Supabase row."""
    client = _get_supabase_client()
    payload = {
        "ai_metadata": metadata,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    try:
        client.table("product_images").update(payload).eq("id", image_id).execute()
    except APIError as exc:
        raise RuntimeError(f"Failed to update product_images.ai_metadata: {exc}")


def _analyze(image_id: Optional[str], image_url: Optional[str]) -> Dict[str, Any]:
    """Core analysis path shared by the HTTP handler for reuse and testability."""
    derived_url = image_url
    record: Optional[Dict[str, Any]] = None

    if image_id:
        record = _fetch_product_image_record(image_id)
        derived_url = _select_image_url(record)

    if not derived_url:
        raise ValueError("No image URL provided or found in Supabase record")

    image_bytes = _download_image(derived_url)
    model_id = os.environ.get("GEMINI_MODEL_ID", "gemini-2.5-flash")
    analysis = _call_gemini(image_bytes=image_bytes, model_id=model_id)

    if image_id and record is not None:
        _update_ai_metadata(image_id=image_id, metadata=analysis)

    return {
        "source_image_url": derived_url,
        "analysis": analysis,
    }


@functions_framework.http
def analyze_product_image(request):
    """HTTP Cloud Function entry point."""
    if request.method != "POST":
        return ("Method Not Allowed", 405)

    try:
        payload = request.get_json(silent=True) or {}
    except Exception:
        return (json.dumps({"error": "Invalid JSON body"}), 400, {"Content-Type": "application/json"})

    image_id = payload.get("product_image_id")
    image_url = payload.get("image_url")

    try:
        result = _analyze(image_id=image_id, image_url=image_url)
    except ValueError as exc:
        return (
            json.dumps({"error": str(exc)}),
            400,
            {"Content-Type": "application/json"},
        )
    except Exception as exc:
        return (
            json.dumps({"error": str(exc)}),
            500,
            {"Content-Type": "application/json"},
        )

    return (
        json.dumps(result),
        200,
        {"Content-Type": "application/json"},
    )
