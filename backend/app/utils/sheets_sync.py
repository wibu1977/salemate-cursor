import json
import gspread
from google.oauth2.service_account import Credentials

from app.config import get_settings

settings = get_settings()

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


async def read_google_sheet(spreadsheet_id: str, sheet_name: str = "Sheet1") -> list[dict]:
    """Read all rows from a Google Sheet as list of dicts."""
    creds_data = json.loads(settings.GOOGLE_SHEETS_CREDENTIALS) if settings.GOOGLE_SHEETS_CREDENTIALS else {}
    if not creds_data:
        raise ValueError("Google Sheets credentials not configured")

    credentials = Credentials.from_service_account_info(creds_data, scopes=SCOPES)
    client = gspread.authorize(credentials)

    spreadsheet = client.open_by_key(spreadsheet_id)
    worksheet = spreadsheet.worksheet(sheet_name)

    return worksheet.get_all_records()
