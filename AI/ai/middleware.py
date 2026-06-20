from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from ai.build_log import needs_rebuild


class VectorDBMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):

        if request.url.path == "/api/ai/chat":

            auth = request.headers.get("authorization")

            if auth:
                token = auth.replace("Bearer ", "").strip()

                # flag only (NO rebuild here)
                request.state.token = token
                request.state.rebuild_needed = needs_rebuild(token)

        response = await call_next(request)
        return response