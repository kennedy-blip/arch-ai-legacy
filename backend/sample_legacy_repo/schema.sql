-- schema.sql: Core Banking Data Model
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
