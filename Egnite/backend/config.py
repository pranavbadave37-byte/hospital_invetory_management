import os
from pathlib import Path
from dotenv import load_dotenv

# Egnite/
BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env
load_dotenv(Path(__file__).resolve().parent / ".env")

# Frontend folder
FRONTEND_DIR = str(BASE_DIR / "frontend")

# Oracle configuration
ORACLE_USER = os.getenv("ORACLE_USER", "")
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD", "")
ORACLE_DSN = os.getenv("ORACLE_DSN", "")

# Flask / JWT
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "8"))