# api_gateway.py
from fastapi import FastAPI, HTTPException
import json

app = FastAPI(title="Legacy Ingress Gateway")

@app.post("/api/v1/orders")
def handle_incoming_order(order_data: dict):
    """Ingress API entry point for merchant orders."""
    order_id = order_data.get("order_id", "ORD-9912")
    amount = float(order_data.get("amount", 1250.0))
    customer_id = order_data.get("customer_id", "CUST-404")

    # Delegate to Java OrderProcessor via RPC bridge
    status = invoke_order_pipeline(order_id, amount, customer_id)
    return {"status": "QUEUED", "order_id": order_id, "processed": status}

def invoke_order_pipeline(order_id: str, amount: float, customer_id: str) -> bool:
    # Crosses boundary into OrderProcessor.java:processOrder()
    return True
