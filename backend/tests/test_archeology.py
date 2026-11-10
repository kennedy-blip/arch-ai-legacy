"""
Unit and integration tests for Archaeo-Code backend engine.
Tests AST parsing across Java, Python, and SQL, Git Archeology,
Cypher multi-hop call-chain traversal, and blast radius calculation.
"""

import os
import sys
import pytest
from typing import Dict, Any

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.parsers.ast_parser import PolyglotASTParser, extract_sql_operations
from app.parsers.git_archeologist import GitArcheologist
from app.rag.graph_rag import GraphRAGEngine
from app.core.neo4j_client import InMemoryGraphStore, Neo4jClient


def test_sql_operation_extractor():
    """Verify regex-based SQL table mutation and stored procedure extraction."""
    sql = """
    INSERT INTO AUDIT_LOG (event, created_at) VALUES ('ORDER_CREATED', NOW());
    UPDATE ACCOUNTS SET balance = balance - 100 WHERE id = 1;
    SELECT * FROM CUSTOMER_RISK_PROFILES WHERE risk_tier = 'HIGH';
    CALL sp_settle_batch('BATCH_001');
    """
    mutated, read, procs, ops = extract_sql_operations(sql)

    assert "AUDIT_LOG" in mutated
    assert "ACCOUNTS" in mutated
    assert "CUSTOMER_RISK_PROFILES" in read
    assert "sp_settle_batch" in procs


def test_polyglot_ast_parser_java():
    """Verify Java method, class, RPC, and stored procedure extraction."""
    java_code = """package com.legacybank.orders;
import org.springframework.web.bind.annotation.RestController;
import java.sql.CallableStatement;

@RestController
public class OrderService {
    public int executeTrade(String tradeId, double amount) {
        CallableStatement cstmt = conn.prepareCall("{call sp_audit_transfer(?, ?, ?)}");
        String update = "UPDATE TRANSACTION_LEDGER SET settled = 1 WHERE trade_id = 123";
        return 1;
    }
}
"""
    parser = PolyglotASTParser()
    parser._parse_java("OrderService.java", java_code)
    parser._resolve_inter_function_calls()

    # Verify Classes
    assert len(parser.entities.classes) >= 1
    cls = parser.entities.classes[0]
    assert cls.name == "OrderService"
    assert cls.is_rpc_interface is True

    # Verify Functions
    funcs = [f for f in parser.entities.functions if f.name == "executeTrade"]
    assert len(funcs) == 1
    fn = funcs[0]
    assert fn.language == "java"

    # Verify Calls to Stored Procedure
    sp_calls = [c for c in parser.entities.calls if "sp_audit_transfer" in c.target_id]
    assert len(sp_calls) >= 1

    # Verify Table Mutations
    table_muts = [m for m in parser.entities.mutations if m.table_name == "TRANSACTION_LEDGER"]
    assert len(table_muts) >= 1


def test_polyglot_ast_parser_python():
    """Verify Python function, RPC decorator, and SQL extraction."""
    py_code = """
from fastapi import FastAPI
app = FastAPI()

@app.post("/api/v1/settle")
def trigger_settlement(batch_id: str):
    sql = "UPDATE SETTLEMENT_ACCOUNTS SET status = 'DONE' WHERE id = 1"
    execute_rpc_call(batch_id)
    return {"status": "OK"}

def execute_rpc_call(batch: str):
    return True
"""
    parser = PolyglotASTParser()
    parser._parse_python("api.py", py_code)
    parser._resolve_inter_function_calls()

    funcs = {f.name: f for f in parser.entities.functions}
    assert "trigger_settlement" in funcs
    assert funcs["trigger_settlement"].is_rpc is True

    # Check internal call edge
    calls = [c for c in parser.entities.calls if c.target_id.endswith("execute_rpc_call")]
    assert len(calls) >= 1

    # Check table mutation
    muts = [m for m in parser.entities.mutations if m.table_name == "SETTLEMENT_ACCOUNTS"]
    assert len(muts) >= 1


def test_in_memory_graph_store():
    """Verify graph indexing, multi-hop call-chain traversal, and blast radius in memory."""
    store = InMemoryGraphStore()
    store.clear()

    # Add Nodes
    store.merge_node("Function", "fn:api_gateway", {"name": "api_gateway", "language": "python", "file_path": "api.py", "start_line": 10, "end_line": 20})
    store.merge_node("Function", "fn:order_proc", {"name": "order_proc", "language": "java", "file_path": "Order.java", "start_line": 40, "end_line": 60})
    store.merge_node("Function", "fn:payment_rpc", {"name": "payment_rpc", "language": "java", "file_path": "Pay.java", "start_line": 15, "end_line": 25, "is_rpc": True})
    store.merge_node("DatabaseTable", "table:ACCOUNTS", {"name": "ACCOUNTS"})

    # Add Edges
    store.merge_edge("fn:api_gateway", "fn:order_proc", "CALLS", {"is_rpc": True, "call_expr": "order_proc()"})
    store.merge_edge("fn:order_proc", "fn:payment_rpc", "CALLS", {"is_rpc": True, "call_expr": "payment_rpc()"})
    store.merge_edge("fn:order_proc", "table:ACCOUNTS", "MUTATES_TABLE", {"operation": "UPDATE"})

    # Traverse Call Chain from seed
    chain = store.get_call_chain("fn:order_proc", max_depth=3)
    node_ids = {n["id"] for n in chain["nodes"]}

    assert "fn:order_proc" in node_ids
    assert "fn:payment_rpc" in node_ids
    assert "table:ACCOUNTS" in node_ids
    # Should also include upstream caller
    assert "fn:api_gateway" in node_ids

    # Blast Radius calculation
    engine = GraphRAGEngine()
    blast = engine.compute_blast_radius("fn:order_proc", chain)

    assert blast["upstream_caller_count"] >= 1
    assert blast["downstream_function_count"] >= 1
    assert "ACCOUNTS" in blast["mutated_tables"]
    assert blast["risk_score"] > 50


def test_git_archeologist_simulation():
    """Verify legacy blame analysis and risk classification."""
    archeo = GitArcheologist(".")
    blame = archeo.analyze_function_blame(
        file_path="OrderProcessor.java",
        start_line=16,
        end_line=52,
        function_id="OrderProcessor.processOrder"
    )

    assert blame.function_id == "OrderProcessor.processOrder"
    assert blame.days_since_last_edit > 1000
    assert "CRITICAL_LEGACY" in blame.legacy_risk_badge
    assert len(blame.blame_lines) > 0
    assert blame.blame_lines[0].author_name != ""
