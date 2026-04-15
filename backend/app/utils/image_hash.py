import io
from PIL import Image
import imagehash


def compute_image_hash(image_bytes: bytes) -> str:
    """
    Compute perceptual hash of bill image.
    Resistant to minor edits (crop, resize, compression).
    Used for duplicate bill detection (Layer 4 fraud check).
    """
    image = Image.open(io.BytesIO(image_bytes))
    phash = imagehash.phash(image)
    return str(phash)
