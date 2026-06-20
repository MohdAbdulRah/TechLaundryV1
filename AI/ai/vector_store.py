import requests
import shutil
import os

from datetime import datetime

from langchain.schema import Document
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

from ai.config import NODE_API_URL
from ai.build_log import write_log

vector_db = None
DB_DIR = "laundry_vector_db"
DATE_FILE = f"{DB_DIR}/build_date.txt"


embedding = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)




def fetch_shop_data(token: str):

    headers = {
        "Authorization": f"Bearer {token}"
    }

    response = requests.get(
        NODE_API_URL,
        headers=headers
    )

    response.raise_for_status()

    return response.json()["data"]


def build_documents(shops):

    docs = []

    for shop in shops:

        shop_name = shop.get("name", "")
        shop_address = shop.get("address", "")
        shop_rating = shop.get("rating", 0)
        total_orders = shop.get("totalOrders", 0)
        success_rate = shop.get("successRate", 0)
        avg_delivery = shop.get("avgDeliveryTime", 0)
        distance = round(shop.get("distance", 0) / 1000, 2)

        prices = shop.get("prices", [])

        for service in prices:

            category = service.get("category")

            category_name = ""

            if isinstance(category, dict):
                category_name = category.get("name", "")

            express_available = service.get("expressAvailable")

            if express_available is True:
                express_text = "Quick one day laundry available"
            else:
                express_text = "Standard delivery only"

            text = f"""
            Shop Name: {shop_name}

            Address: {shop_address}

            Distance: {distance} KM

            Shop Rating: {shop_rating}

            Total Orders: {total_orders}

            Success Rate: {success_rate}

            Average Delivery Time: {avg_delivery} minutes

            Service Name: {service.get("name", "")}

            Service Charge: ₹{service.get("charge", 0)}

            Service Category: {category_name}

            Times Ordered: {service.get("timesOrdered", 0)}

            Average Review: {service.get("avgReview", 0)}

            Express Service: {express_text}
            """

            docs.append(
                Document(
                    page_content=text,
                    metadata={
                        "shop_name": shop_name,
                        "service_name": service.get("name")
                    }
                )
            )

    return docs


def save_build_date():

    today = str(datetime.now().date())

    with open(DATE_FILE, "w") as file:
        file.write(today)


def get_saved_build_date():

    if not os.path.exists(DATE_FILE):
        return None

    with open(DATE_FILE, "r") as file:
        return file.read().strip()


def rebuild_vector_db(token: str):

    global vector_db

    shops = fetch_shop_data(token)
    docs = build_documents(shops)

    # IMPORTANT: safe delete
    if os.path.exists(DB_DIR):
        try:
            shutil.rmtree(DB_DIR)
        except Exception:
            pass  # ignore lock issues safely

    vector_db = Chroma.from_documents(
        documents=docs,
        embedding=embedding,
        persist_directory=DB_DIR
    )

    write_log(token)  # mark rebuild done
def load_existing_vector_db():

    global vector_db

    vector_db = Chroma(
        persist_directory=DB_DIR,
        embedding_function=embedding
    )

    print("✅ Existing Vector DB loaded")

    return vector_db


def load_vector_db(token: str, rebuild: bool = False):

    global vector_db

    if rebuild or vector_db is None:
        rebuild_vector_db(token)
        return vector_db

    return vector_db