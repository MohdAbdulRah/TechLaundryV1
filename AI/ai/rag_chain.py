from langchain.chains import RetrievalQA
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate

from ai.config import GEMINI_API_KEY
from ai.vector_store import load_vector_db


PROMPT_TEMPLATE = """
You are an intelligent laundry recommendation assistant.

You help users choose:
- best laundry shop
- cheapest service
- fastest delivery
- express laundry
- top rated services
- most ordered services

IMPORTANT RULES:

- Express Available means:
  same-day or quick laundry delivery.

- If expressAvailable is false or missing:
  express laundry is NOT available.

- NEVER mention database field names like:
  expressAvailable, avgReview, true, false.

- Answer naturally like a real assistant.

- Compare services when useful.

- Prefer:
  higher ratings,
  faster delivery,
  better reviews,
  more orders,
  lower price.

Use ONLY the provided context.

Context:
{context}

Question:
{question}

Helpful Answer:
"""


PROMPT = PromptTemplate(
    template=PROMPT_TEMPLATE,
    input_variables=["context", "question"]
)


def get_chain():

    vector_db = load_vector_db()

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=GEMINI_API_KEY,
        temperature=0.3
    )

    retriever = vector_db.as_retriever(
        search_kwargs={"k": 6}
    )

    chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        chain_type="stuff",
        chain_type_kwargs={
            "prompt": PROMPT
        }
    )

    return chain

def get_chain_from_vector(vector_db):

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=GEMINI_API_KEY,
        temperature=0.3
    )

    retriever = vector_db.as_retriever(
        search_kwargs={"k": 6}
    )

    chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        chain_type="stuff",
        chain_type_kwargs={
            "prompt": PROMPT
        }
    )

    return chain