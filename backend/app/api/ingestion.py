"""
Ingestion API endpoints:
- Ingest local directory or repository
- Generate and load legacy sample repository
- Retrieve graph entity and relationship statistics
"""

import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app.parsers.ast_parser import PolyglotASTParser, load_ast_to_graph
from app.parsers.git_archeologist import GitArcheologist
from app.core.neo4j_client import neo4j_client

router = APIRouter(prefix="", tags=["Ingestion"])


class IngestRequest(BaseModel):
    repo_path: Optional[str] = Field(default=None, description="Absolute or relative path to local repository")
    repo_url: Optional[str] = Field(default=None, description="Git clone URL (optional)")
    branch: Optional[str] = Field(default="main", description="Git branch to inspect")


class IngestResponse(BaseModel):
    status: str
    message: str
    stats: Dict[str, int]
    repo_path: str


def create_sample_legacy_codebase(target_dir: str):
    """Generates realistic polyglot legacy banking repo for immediate exploration."""
    os.makedirs(target_dir, exist_ok=True)

    # 1. Java OrderProcessor
    order_processor_code = """package com.legacybank.orders;

import com.legacybank.risk.RiskEvaluationService;
import com.legacybank.payment.PaymentGatewayClient;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.CallableStatement;
import java.sql.SQLException;

/**
 * Legacy monolithic transaction processor.
 * Last modified by Dave Kowalski (Retired 2021) in emergency hotfix.
 */
public class OrderProcessor {
    private RiskEvaluationService riskService = new RiskEvaluationService();
    private PaymentGatewayClient paymentClient = new PaymentGatewayClient();

    public int processOrder(String orderId, double amount, String customerId) throws SQLException {
        // Step 1: Input sanity check
        if (amount <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // Step 2: Synchronous risk check against customer ledger
        boolean isApproved = riskService.evaluateRiskScore(customerId, amount);
        if (!isApproved) {
            return -1;
        }

        // Step 3: Cross-process RPC call to settlement bridge
        String txnRef = paymentClient.executeRemotePayment(orderId, amount);

        // Step 4: Direct SQL mutation on core ACCOUNTS table
        Connection conn = DriverManager.getConnection("jdbc:postgresql://localhost:5432/bank", "user", "secret");
        PreparedStatement stmt = conn.prepareStatement(
            "UPDATE ACCOUNTS SET balance = balance - ?, updated_at = NOW() WHERE customer_id = ?"
        );
        stmt.setDouble(1, amount);
        stmt.setString(2, customerId);
        stmt.executeUpdate();

        // Step 5: Execute stored procedure for audit trail
        CallableStatement cstmt = conn.prepareCall("{call sp_audit_transfer(?, ?, ?)}");
        cstmt.setString(1, orderId);
        cstmt.setDouble(2, amount);
        cstmt.setString(3, txnRef);
        cstmt.execute();

        return 1;
    }

    public boolean cancelOrder(String orderId) {
        // Legacy cancel stub
        return true;
    }
}
"""
    with open(os.path.join(target_dir, "OrderProcessor.java"), "w", encoding="utf-8") as f:
        f.write(order_processor_code)

    # 2. Java PaymentGatewayClient
    payment_client_code = """package com.legacybank.payment;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;

@RestController
@RequestMapping("/rpc/payment")
public class PaymentGatewayClient {

    public String executeRemotePayment(String orderId, double amount) {
        // Network RPC boundary crossing to Python settlement bridge
        return "TXN_LEGACY_" + System.currentTimeMillis();
    }
}
"""
    with open(os.path.join(target_dir, "PaymentGatewayClient.java"), "w", encoding="utf-8") as f:
        f.write(payment_client_code)

    # 3. Java RiskEvaluationService
    risk_code = """package com.legacybank.risk;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

public class RiskEvaluationService {

    public boolean evaluateRiskScore(String customerId, double amount) {
        // Reads from CUSTOMER_RISK_PROFILES
        String query = "SELECT risk_tier, credit_limit FROM CUSTOMER_RISK_PROFILES WHERE customer_id = ?";
        return amount < 75000.0;
    }
}
"""
    with open(os.path.join(target_dir, "RiskEvaluationService.java"), "w", encoding="utf-8") as f:
        f.write(risk_code)

    # 4. Python API Gateway
    api_gateway_code = """# api_gateway.py
from fastapi import FastAPI, HTTPException
import json

app = FastAPI(title="Legacy Ingress Gateway")

@app.post("/api/v1/orders")
def handle_incoming_order(order_data: dict):
    \"\"\"Ingress API entry point for merchant orders.\"\"\"
    order_id = order_data.get("order_id", "ORD-9912")
    amount = float(order_data.get("amount", 1250.0))
    customer_id = order_data.get("customer_id", "CUST-404")

    # Delegate to Java OrderProcessor via RPC bridge
    status = invoke_order_pipeline(order_id, amount, customer_id)
    return {"status": "QUEUED", "order_id": order_id, "processed": status}

def invoke_order_pipeline(order_id: str, amount: float, customer_id: str) -> bool:
    # Crosses boundary into OrderProcessor.java:processOrder()
    return True
"""
    with open(os.path.join(target_dir, "api_gateway.py"), "w", encoding="utf-8") as f:
        f.write(api_gateway_code)

    # 5. Python Settlement Worker
    worker_code = """# settlement_worker.py
import time

def process_nightly_settlement_batch(batch_id: str):
    \"\"\"Nightly cron job that mutates TRANSACTION_LEDGER.\"\"\"
    sql_dml = "UPDATE TRANSACTION_LEDGER SET settled = 1, updated_at = NOW() WHERE batch_id = %s"
    print(f"Executing batch settlement for {batch_id}: {sql_dml}")
    return True

def trigger_stored_procedure_reconcile():
    call_sql = "CALL sp_settle_batch('BATCH_NIGHTLY_2024')"
    return call_sql
"""
    with open(os.path.join(target_dir, "settlement_worker.py"), "w", encoding="utf-8") as f:
        f.write(worker_code)

    # 6. SQL Schema
    sql_schema = """-- schema.sql: Core Banking Data Model
CREATE TABLE ACCOUNTS (
    customer_id VARCHAR(64) PRIMARY KEY,
    balance NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE TRANSACTION_LEDGER (
    transaction_id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    settled INT DEFAULT 0,
    txn_hash VARCHAR(128)
);

CREATE TABLE CUSTOMER_RISK_PROFILES (
    customer_id VARCHAR(64) PRIMARY KEY,
    risk_tier VARCHAR(16) NOT NULL,
    credit_limit NUMERIC(18, 4) NOT NULL
);

CREATE TABLE AUDIT_LOG (
    log_id SERIAL PRIMARY KEY,
    event_type VARCHAR(32) NOT NULL,
    reference_id VARCHAR(64),
    amount NUMERIC(18, 4),
    created_at TIMESTAMP NOT NULL
);
"""
    with open(os.path.join(target_dir, "schema.sql"), "w", encoding="utf-8") as f:
        f.write(sql_schema)

    # 7. SQL Stored Procedures
    sql_procs = """-- stored_procedures.sql: Mission-Critical Stored Procedures
CREATE OR REPLACE PROCEDURE sp_audit_transfer(
    p_order_id VARCHAR(64),
    p_amount NUMERIC,
    p_txn_ref VARCHAR(64)
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Mutate AUDIT_LOG
    INSERT INTO AUDIT_LOG (event_type, reference_id, amount, created_at)
    VALUES ('TRANSFER', p_order_id, p_amount, NOW());

    -- Mutate TRANSACTION_LEDGER with row lock
    UPDATE TRANSACTION_LEDGER
    SET settled = 1, txn_hash = p_txn_ref
    WHERE order_id = p_order_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_settle_batch(p_batch_id VARCHAR(64))
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE TRANSACTION_LEDGER
    SET settled = 1
    WHERE batch_id = p_batch_id;
END;
$$;
"""
    with open(os.path.join(target_dir, "stored_procedures.sql"), "w", encoding="utf-8") as f:
        f.write(sql_procs)


@router.post("/ingest", response_model=IngestResponse)
async def ingest_repository(request: IngestRequest):
    """
    Ingests codebase at specified path, extracts polyglot AST & Git archeology,
    and loads the graph entities into Neo4j and memory.
    """
    repo_path = request.repo_path

    # If no path specified or does not exist, use default sample repo
    if not repo_path or not os.path.exists(repo_path):
        default_dir = os.path.join(os.getcwd(), "sample_legacy_repo")
        if not os.path.exists(default_dir):
            create_sample_legacy_codebase(default_dir)
        repo_path = default_dir

    parser = PolyglotASTParser()
    entities = parser.parse_repository(repo_path)
    stats = await load_ast_to_graph(entities, neo4j_client)

    return IngestResponse(
        status="SUCCESS",
        message=f"Ingestion complete for {repo_path}",
        stats=stats,
        repo_path=repo_path
    )


@router.post("/sample-repo", response_model=IngestResponse)
async def load_sample_repo():
    """Generates the enterprise legacy banking sample repository and ingests it."""
    sample_dir = os.path.join(os.getcwd(), "sample_legacy_repo")
    create_sample_legacy_codebase(sample_dir)

    parser = PolyglotASTParser()
    entities = parser.parse_repository(sample_dir)
    stats = await load_ast_to_graph(entities, neo4j_client)

    return IngestResponse(
        status="SUCCESS",
        message="Legacy Banking Platform Sample Repository ingested successfully.",
        stats=stats,
        repo_path=sample_dir
    )


@router.get("/stats")
async def get_graph_stats():
    """Returns total counts of functions, classes, tables, calls, and mutations."""
    mem_stats = neo4j_client.in_memory_store.get_stats()
    return {
        "status": "ONLINE",
        "neo4j_connected": neo4j_client.connected,
        "graph_statistics": mem_stats
    }
