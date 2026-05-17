import cloudinary
import cloudinary.uploader
from uuid import uuid4
from app.config import get_settings

settings = get_settings()

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


class StorageService:
    @staticmethod
    async def upload_bill_image(image_bytes: bytes, order_id: str) -> str:
        """Upload bill image to Cloudinary and return URL."""
        try:
            result = cloudinary.uploader.upload(
                image_bytes,
                folder="salemate/bills",
                public_id=f"bill_{order_id}",
                resource_type="image",
            )
            return result.get("secure_url", "")
        except Exception:
            return ""

    @staticmethod
    async def upload_product_image(
        image_bytes: bytes, workspace_id: str, row_index: int
    ) -> str:
        """Upload a product image extracted from a spreadsheet to Cloudinary.

        Images are auto-resized to 800×800 (keeping aspect ratio) and stored
        under ``salemate/products/{workspace_id}/``.
        """
        try:
            result = cloudinary.uploader.upload(
                image_bytes,
                folder=f"salemate/products/{workspace_id}",
                public_id=f"import_row_{row_index}_{uuid4().hex[:8]}",
                resource_type="image",
                transformation=[{"width": 800, "height": 800, "crop": "limit"}],
            )
            return result.get("secure_url", "")
        except Exception:
            return ""

    @staticmethod
    async def upload_product_image_for_id(
        image_bytes: bytes, workspace_id: str, product_id: str
    ) -> str:
        """Upload a catalog product photo (manual / camera); returns Cloudinary HTTPS URL."""
        try:
            result = cloudinary.uploader.upload(
                image_bytes,
                folder=f"salemate/products/{workspace_id}",
                public_id=f"product_{product_id}_{uuid4().hex[:12]}",
                resource_type="image",
                transformation=[{"width": 800, "height": 800, "crop": "limit"}],
            )
            return result.get("secure_url", "")
        except Exception:
            return ""

