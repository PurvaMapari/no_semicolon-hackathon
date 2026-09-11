import base64
import html
import re
import zipfile
from pathlib import Path
from typing import Any, List, Tuple

import pdfplumber


def extract_text_and_tables_from_pdf(filepath: str) -> Tuple[str, List[List[List[Any]]]]:
    """Extract prose and tables separately from a PDF."""
    pages_text: List[str] = []
    pages_tables: List[List[List[Any]]] = []
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {filepath}")

    try:
        with pdfplumber.open(path) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                found_tables = page.find_tables()
                table_bboxes = [table.bbox for table in found_tables]

                def is_inside_table(obj, boxes=table_bboxes) -> bool:
                    return any(
                        obj["x0"] >= x0 and obj["x1"] <= x1
                        and obj["top"] >= top and obj["bottom"] <= bottom
                        for x0, top, x1, bottom in boxes
                    )

                prose_page = page.filter(lambda obj: not is_inside_table(obj))
                page_text = (prose_page.extract_text() or "").strip()
                if not page_text:
                    page_text = f"[No extractable prose text found on page {page_number}; OCR may be required.]"
                pages_text.append(page_text)
                pages_tables.append([table.extract() for table in found_tables])
    except Exception as error:
        raise RuntimeError(f"Could not extract PDF content from {filepath}: {error}") from error

    return "\n\n".join(pages_text), pages_tables


def extract_source_images_from_pdf(filepath: str, max_images: int = 6) -> List[str]:
    """
    Extract embedded raster images from a PDF and return them as a list of
    base64-encoded PNG/JPEG strings (data-URI ready).

    Uses pdfplumber's page.images to locate image bounding boxes, then crops
    each page to that region with PIL and encodes to PNG.  Falls back
    gracefully — if PIL/Pillow is unavailable, or a page has no images, the
    list will simply be shorter or empty.

    Returns [] rather than raising so callers never crash on missing images.
    """
    results: List[str] = []
    path = Path(filepath)
    if not path.exists():
        return results

    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return results  # PIL not installed — skip silently

    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                if len(results) >= max_images:
                    break
                imgs = page.images  # list of dicts with x0,top,x1,bottom,width,height
                if not imgs:
                    continue

                # Render the full page as a PIL image at 150 DPI
                try:
                    pil_page = page.to_image(resolution=150).original
                except Exception:
                    continue  # page render failed — skip

                page_w = page.width
                page_h = page.height
                img_w, img_h = pil_page.size

                scale_x = img_w / page_w
                scale_y = img_h / page_h

                for img_meta in imgs:
                    if len(results) >= max_images:
                        break
                    try:
                        x0  = int(img_meta["x0"]     * scale_x)
                        y0  = int(img_meta["top"]     * scale_y)
                        x1  = int(img_meta["x1"]      * scale_x)
                        y1  = int(img_meta["bottom"]  * scale_y)

                        # Skip tiny thumbnails (< 60 px in either dimension)
                        if (x1 - x0) < 60 or (y1 - y0) < 60:
                            continue

                        cropped = pil_page.crop((x0, y0, x1, y1))
                        buf = __import__("io").BytesIO()
                        cropped.save(buf, format="PNG")
                        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                        results.append(b64)
                    except Exception:
                        continue  # individual image extraction failed — skip
    except Exception:
        pass  # any PDF-level error — return what we have

    return results


def extract_text_from_image(filepath: str) -> str:
    """Extract text from an image with Tesseract OCR."""
    try:
        from PIL import Image
        import pytesseract
    except ImportError as error:
        raise RuntimeError("Install Pillow and pytesseract to use image OCR.") from error

    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {filepath}")
    try:
        text = pytesseract.image_to_string(Image.open(path)).strip()
    except Exception as error:
        raise RuntimeError(f"Could not extract text from image {filepath}: {error}") from error
    return text or "[No text detected in image; it may be blank or too low-quality for OCR.]"


def extract_text_from_document(filepath: str) -> Tuple[str, List[List[List[Any]]]]:
    """Extract text from the document types advertised by the frontend."""
    path = Path(filepath)
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_text_and_tables_from_pdf(str(path))
    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="replace"), []
    if suffix == ".docx":
        try:
            with zipfile.ZipFile(path) as archive:
                document_xml = archive.read("word/document.xml").decode("utf-8")
        except (KeyError, zipfile.BadZipFile) as error:
            raise RuntimeError(f"Could not read DOCX file: {path.name}") from error
        text = re.sub(r"</w:p>|</w:tr>", "\n", document_xml)
        text = re.sub(r"<w:tab[^>]*/>", "\t", text)
        text = re.sub(r"<[^>]+>", "", text)
        return html.unescape(text).strip(), []
    if suffix == ".epub":
        paragraphs = []
        try:
            with zipfile.ZipFile(path) as archive:
                for name in archive.namelist():
                    if Path(name).suffix.lower() not in {".html", ".xhtml", ".htm"}:
                        continue
                    markup = archive.read(name).decode("utf-8", errors="replace")
                    markup = re.sub(r"<script\b[^>]*>.*?</script>", " ", markup, flags=re.IGNORECASE | re.DOTALL)
                    markup = re.sub(r"<style\b[^>]*>.*?</style>", " ", markup, flags=re.IGNORECASE | re.DOTALL)
                    paragraphs.append(re.sub(r"<[^>]+>", " ", markup))
        except zipfile.BadZipFile as error:
            raise RuntimeError(f"Could not read EPUB file: {path.name}") from error
        text = re.sub(r"\s+", " ", html.unescape(" ".join(paragraphs))).strip()
        return text, []
    raise ValueError("Unsupported document type. Use PDF, TXT, DOCX, or EPUB.")
