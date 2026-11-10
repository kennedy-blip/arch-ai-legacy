package com.legacybank.orders;

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
