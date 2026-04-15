import random
import string


def generate_memo_code() -> str:
    """
    Generate unique memo code for orders.
    Format: SM_XXXX where X is alphanumeric.
    Backend-only generation - AI must never create these.
    """
    chars = string.digits
    code = "".join(random.choices(chars, k=6))
    return f"SM_{code}"
