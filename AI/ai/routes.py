from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from fastapi import Request
from ai.vector_store import load_vector_db


from ai.rag_chain import get_chain,get_chain_from_vector

router = APIRouter()


class ChatRequest(BaseModel):
    question: str



@router.post("/api/ai/chat")
async def ai_chat(
    data: ChatRequest,
    request: Request,
    authorization: str = Header(None)
):

    token = request.state.token

    rebuild = getattr(request.state, "rebuild_needed", False)

    vector_db = load_vector_db(token, rebuild=rebuild)

    chain = get_chain_from_vector(vector_db)

    response = chain.invoke({"query": data.question})

    return {
        "success": True,
        "answer": response["result"]
    }