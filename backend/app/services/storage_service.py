import cloudinary
import cloudinary.uploader
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
