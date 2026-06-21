import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

NODE_API_URL = os.getenv("NODE_API_URL")

VECTOR_DB_PATH = "./laundry_vector_db"