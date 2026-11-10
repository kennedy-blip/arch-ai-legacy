-- stored_procedures.sql: Mission-Critical Stored Procedures
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
