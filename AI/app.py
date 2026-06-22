from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
from ai.routes import router as ai_router

from ai.vector_store import load_vector_db
from PIL import Image
from ai.middleware import VectorDBMiddleware

import io
# uvicorn app:app --reload
from pricing import get_price_range
from ai.scheduler import start_scheduler


app = FastAPI()

app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)

app.add_middleware(VectorDBMiddleware)
app.include_router(ai_router)


# -----------------------------
# LOAD MODELS
# -----------------------------

garment_classifier = None
fabric_classifier = None


def load_models():
    global garment_classifier, fabric_classifier

    if garment_classifier is None:
        print("Loading garment model...")
        garment_classifier = pipeline(
            "image-classification",
            model="mohdabdulrahman510/best_garment_model"
        )
        print("Garment model loaded")

    if fabric_classifier is None:
        print("Loading fabric model...")
        fabric_classifier = pipeline(
            "image-classification",
            model="mohdabdulrahman510/best_fabric_model"
        )
        print("Fabric model loaded")
# -----------------------------
# API
# -----------------------------
GARMENT_LABELS = ['blouse', 'dhoti_pants', 'dupatta', 'gowns', 'kurta_men', 'leggings_and_salwars', 'lehenga', 'nehru_jacket', 'palazzo', 'petticoat', 'saree', 'sherwani', 'women_kurta']

FABRIC_LABELS = [
    'art silk',
    'banarasi silk',
    'bandhej',
    'banglori silk',
    'brasso',
    'brocade',
    'chanderi',
    'chiffon',
    'cotton',
    'crepe',
    'dupion silk',
    'georgette',
    'jacquard',
    'khadi',
    'kora silk',
    'linen',
    'lycra',
    'net',
    'organza',
    'phantom silk',
    'phulkari',
    'polyester',
    'rayon',
    'satin',
    'silk',
    'taffeta silk',
    'tissue',
    'velvet',
    'viscose'
]


@app.post("/api/predict/garment")
async def predict(file: UploadFile = File(...)):
    print("Request received")
    load_models() 
    image_bytes = await file.read()

    image = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")
    print("Image loaded")
    # -------------------------
    # GARMENT PREDICTION
    # -------------------------

    garment_result = garment_classifier(image)
    print("Garment predicted")
    garment_idx = int(
    garment_result[0]["label"].split("_")[1]
    )

    garment = GARMENT_LABELS[garment_idx]



    garment_confidence = round(
        garment_result[0]["score"],
        4
    )

    # -------------------------
    # FABRIC PREDICTION
    # -------------------------

    fabric_result = fabric_classifier(image)

    fabric_idx = int(
       fabric_result[0]["label"].split("_")[1]
    )
    
    fabric = FABRIC_LABELS[fabric_idx]
    print("Fabric predicted")
    fabric_confidence = round(
        fabric_result[0]["score"],
        4
    )

    # -------------------------
    # PRICE
    # -------------------------

    pricing = get_price_range(
        garment,
        fabric
    )

    # -------------------------
    # RESPONSE
    # -------------------------

    return {

        "garment": garment,

        "garment_confidence": garment_confidence,

        "fabric": fabric,

        "fabric_confidence": fabric_confidence,

        "estimated_price_range": {
            "min": pricing["min_price"],
            "max": pricing["max_price"]
        }
    }