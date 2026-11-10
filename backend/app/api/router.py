"""
Master API router aggregating ingestion and explanation modules.
"""

from fastapi import APIRouter
from app.api.ingestion import router as ingestion_router
from app.api.explain import router as explain_router

api_router = APIRouter()

api_router.include_router(ingestion_router, prefix="", tags=["Ingestion"])
api_router.include_router(explain_router, prefix="", tags=["Explanation & Archeology"])
