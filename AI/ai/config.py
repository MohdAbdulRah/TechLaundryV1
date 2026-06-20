import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

NODE_API_URL = "http://localhost:3000/api/general/all/shops"

VECTOR_DB_PATH = "./laundry_vector_db"