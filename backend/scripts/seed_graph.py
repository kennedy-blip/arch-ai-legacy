#!/usr/bin/env python3
"""
CLI utility to ingest codebases into the Archaeo-Code Neo4j Knowledge Graph.
Usage:
    python seed_graph.py --repo /path/to/legacy/repo
"""

import os
import sys
import argparse
import asyncio
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.parsers.ast_parser import PolyglotASTParser, load_ast_to_graph
from app.core.neo4j_client import neo4j_client
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_graph")


async def main():
    parser = argparse.ArgumentParser(description="Archaeo-Code Graph Ingestion CLI")
    parser.add_argument("--repo", type=str, default="./sample_legacy_repo", help="Path to codebase directory")
    args = parser.parse_args()

    repo_path = os.path.abspath(args.repo)
    if not os.path.exists(repo_path):
        logger.error(f"Target path does not exist: {repo_path}")
        sys.exit(1)

    logger.info(f"Connecting to Neo4j at {settings.NEO4J_URI}...")
    await neo4j_client.connect()

    logger.info(f"Extracting Polyglot ASTs from {repo_path}...")
    ast_parser = PolyglotASTParser()
    entities = ast_parser.parse_repository(repo_path)

    logger.info(f"Discovered: {len(entities.functions)} functions, {len(entities.classes)} classes, {len(entities.tables)} tables, {len(entities.calls)} calls.")

    logger.info("Persisting entities and call-graph relationships to Neo4j...")
    stats = await load_ast_to_graph(entities, neo4j_client)

    logger.info("Ingestion completed successfully!")
    for k, v in stats.items():
        logger.info(f"  - {k}: {v}")

    await neo4j_client.close()


if __name__ == "__main__":
    asyncio.run(main())
