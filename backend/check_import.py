import sys
import os

# Thêm directory hiện tại vào sys.path để import được app
sys.path.insert(0, os.getcwd())

try:
    # Set dummy env vars for import
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@localhost/db"
    os.environ["DATABASE_URL_SYNC"] = "postgresql://user:pass@localhost/db"
    os.environ["REDIS_URL"] = "redis://localhost"
    os.environ["META_VERIFY_TOKEN"] = "test"
    
    from app.main import app
    print("App imported successfully!")
except SyntaxError as e:
    print(f"SyntaxError detected: {e}")
    print(f"File: {e.filename}, Line: {e.lineno}, Offset: {e.offset}, Text: {e.text}")
except Exception as e:
    print(f"Error detected: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
