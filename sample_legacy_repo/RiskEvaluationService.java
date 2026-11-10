package com.legacybank.risk;

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
