package com.legacybank.payment;

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
