#!/usr/bin/env python3
"""
Exports the current Archaeo-Code Knowledge Graph to a standalone Cypher script (.cql).
Enables import into Neo4j Aura, Bloom, or on-prem clusters.
Usage:
    python export_cypher.py --output archaeo_graph.cql
"""

import os
import sys
import argparse
import asyncio
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.parsers.ast_parser import PolyglotASTParser
from app.api.ingestion import create_sample_legacy_codebase


def escape_cypher_str(val: str) -> str:
    if val is None:
        return '""'
    return json.dumps(str(val))


def export_cypher(repo_path: str, output_file: str):
    print(f"Parsing AST for Cypher export: {repo_path}")
    parser = PolyglotASTParser()
    entities = parser.parse_repository(repo_path)

    statements = [
        "// ========================================================",
        "// Archaeo-Code Knowledge Graph Cypher Export",
        "// Generated for Neo4j 5.x",
        "// ========================================================",
        "",
        "// 1. Constraints",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (f:Function) REQUIRE f.id IS UNIQUE;",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE;",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (m:Module) REQUIRE m.id IS UNIQUE;",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (t:DatabaseTable) REQUIRE t.name IS UNIQUE;",
        ""
    ]

    # Modules
    statements.append("// 2. Modules")
    for m in entities.modules:
        statements.append(
            f"MERGE (m:Module {{id: {escape_cypher_str(m.id)}}}) "
            f"SET m.name = {escape_cypher_str(m.name)}, m.file_path = {escape_cypher_str(m.file_path)}, m.language = {escape_cypher_str(m.language)};"
        )

    # Classes
    statements.append("\n// 3. Classes")
    for c in entities.classes:
        statements.append(
            f"MERGE (c:Class {{id: {escape_cypher_str(c.id)}}}) "
            f"SET c.name = {escape_cypher_str(c.name)}, c.file_path = {escape_cypher_str(c.file_path)}, "
            f"c.language = {escape_cypher_str(c.language)}, c.is_rpc_interface = {str(c.is_rpc_interface).lower()};"
        )

    # Database Tables
    statements.append("\n// 4. Database Tables")
    for t in entities.tables:
        statements.append(
            f"MERGE (t:DatabaseTable {{name: {escape_cypher_str(t.name)}}}) "
            f"SET t.id = {escape_cypher_str(t.id)};"
        )

    # Functions
    statements.append("\n// 5. Functions & Stored Procedures")
    for f in entities.functions:
        statements.append(
            f"MERGE (f:Function {{id: {escape_cypher_str(f.id)}}}) "
            f"SET f.name = {escape_cypher_str(f.name)}, f.file_path = {escape_cypher_str(f.file_path)}, "
            f"f.language = {escape_cypher_str(f.language)}, f.start_line = {f.start_line}, f.end_line = {f.end_line}, "
            f"f.is_rpc = {str(f.is_rpc).lower()}, f.is_stored_proc = {str(f.is_stored_proc).lower()};"
        )

    # Call Edges
    statements.append("\n// 6. Call Edges")
    for call in entities.calls:
        statements.append(
            f"MATCH (src:Function {{id: {escape_cypher_str(call.source_id)}}}) "
            f"MERGE (tgt:Function {{id: {escape_cypher_str(call.target_id)}}}) "
            f"MERGE (src)-[r:CALLS]->(tgt) "
            f"SET r.is_rpc = {str(call.is_rpc).lower()}, r.line_number = {call.line_number}, r.call_expr = {escape_cypher_str(call.call_expr)};"
        )

    # Mutation Edges
    statements.append("\n// 7. Table Mutation Edges")
    for mut in entities.mutations:
        statements.append(
            f"MATCH (src:Function {{id: {escape_cypher_str(mut.function_id)}}}) "
            f"MATCH (tbl:DatabaseTable {{name: {escape_cypher_str(mut.table_name)}}}) "
            f"MERGE (src)-[r:MUTATES_TABLE]->(tbl) "
            f"SET r.operation = {escape_cypher_str(mut.operation)};"
        )

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(statements) + "\n")

    print(f"Exported {len(statements)} Cypher statements to {output_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export Archaeo-Code graph to Cypher CQL")
    parser.add_argument("--repo", type=str, default="./sample_legacy_repo")
    parser.add_argument("--output", type=str, default="archaeo_graph.cql")
    args = parser.parse_args()

    repo = os.path.abspath(args.repo)
    if not os.path.exists(repo):
        create_sample_legacy_codebase(repo)

    export_cypher(repo, args.output)
