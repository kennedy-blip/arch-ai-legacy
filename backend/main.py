"""
Archaeo-Code Backend Application Entry Point.
Enterprise-grade platform for reverse-engineering legacy codebases without breaking production.
"""

import os
import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure app package is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.core.config import settings
from app.core.neo4j_client import neo4j_client
from app.api.router import api_router
from app.api.ingestion import create_sample_legacy_codebase
from app.parsers.ast_parser import PolyglotASTParser, load_ast_to_graph

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("archaeo.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event handler for Neo4j connections and graph warm-up."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # Attempt connection to Neo4j
    await neo4j_client.connect()

    # Pre-populate sample codebase into in-memory store so UI works immediately
    sample_dir = os.path.join(current_dir, "sample_legacy_repo")
    if not os.path.exists(sample_dir):
        create_sample_legacy_codebase(sample_dir)

    try:
        parser = PolyglotASTParser()
        entities = parser.parse_repository(sample_dir)
        await load_ast_to_graph(entities, neo4j_client)
        logger.info(f"Pre-loaded {len(entities.functions)} legacy functions into archeology graph.")
    except Exception as exc:
        logger.warning(f"Could not warm up sample codebase: {exc}")

    yield

    # Teardown
    await neo4j_client.close()
    logger.info("Neo4j driver connection pool closed. Shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise-grade legacy infrastructure and code archeology platform.",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["System"])
async def health_check():
    """System health check and operational state."""
    return {
        "status": "HEALTHY",
        "service": settings.APP_NAME,
        "neo4j_connected": neo4j_client.connected,
        "in_memory_nodes": len(neo4j_client.in_memory_store.nodes_by_id),
        "in_memory_edges": len(neo4j_client.in_memory_store.edges)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
