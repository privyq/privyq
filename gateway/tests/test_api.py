"""REST API tests exercising the full gateway → SDK → core path."""
import base64


def _b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["services"]["gateway"] == "healthy"


def test_protect_access_verify_flow(client):
    # Protect.
    r = client.post("/api/v1/protect", json={
        "data": _b64("Patient: John Doe. Plan: continue beta-blocker."),
        "policy": {"role": "doctor", "department": "cardiology", "purpose": "treatment"},
        "resource_id": "patient_001",
        "actor": {"user_id": "dr_smith", "role": "doctor", "department": "cardiology"},
    })
    assert r.status_code == 200, r.text
    protected = r.json()
    assert protected["metadata"]["key_id"]

    # Authorized access.
    r = client.post("/api/v1/access", json={
        "protected_data": protected["protected_data"],
        "identity": {"user_id": "dr_smith", "role": "doctor", "department": "cardiology", "purpose": "treatment"},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert base64.b64decode(body["data"]).decode().startswith("Patient: John Doe")

    # Verify the receipt.
    r = client.post("/api/v1/verify", json={"evidence": body["audit_evidence"]})
    assert r.status_code == 200
    v = r.json()
    assert v["verified"] and v["signature_valid"] and v["chain_valid"]


def test_denied_access_returns_403(client):
    r = client.post("/api/v1/protect", json={
        "data": _b64("confidential"),
        "policy": {"role": "doctor", "department": "cardiology"},
        "resource_id": "patient_002",
        "actor": {"user_id": "dr_smith", "role": "doctor"},
    })
    protected = r.json()

    r = client.post("/api/v1/access", json={
        "protected_data": protected["protected_data"],
        "identity": {"user_id": "nurse_jane", "role": "nurse", "department": "general"},
    })
    assert r.status_code == 403, r.text
    assert r.json()["error"]["code"] == "FORBIDDEN"

    # The denied attempt is in the evidence log.
    r = client.get("/api/v1/evidence/log", params={"resource_id": "patient_002"})
    assert r.status_code == 200
    entries = r.json()["entries"]
    assert any(e["result"] == "denied" for e in entries)


def test_key_generation(client):
    r = client.post("/api/v1/keys/generate", json={"type": "encryption", "owner": "dr_smith"})
    assert r.status_code == 200, r.text
    key = r.json()
    assert key["key_id"] and key["algorithm"] == "kyber_768" and key["status"] == "active"


def test_list_keys(client):
    # Generating a key should make it appear in the list.
    gen = client.post("/api/v1/keys/generate", json={"type": "encryption", "owner": "lister"})
    assert gen.status_code == 200
    r = client.get("/api/v1/keys")
    assert r.status_code == 200, r.text
    keys = r.json()["keys"]
    assert any(k["key_id"] == gen.json()["key_id"] for k in keys)
    assert all("status" in k and "algorithm" in k for k in keys)


def test_api_key_store_from_env(monkeypatch):
    # API keys come from a store, not a hardcoded dict (v2 closes C4).
    from app.auth import auth
    monkeypatch.setenv("PRIVYQ_API_KEYS", '{"k_live_x": {"user_id": "svc", "role": "service", "tenant_id": "acme"}}')
    auth._api_key_store.cache_clear()
    try:
        store = auth._api_key_store()
        assert "k_live_x" in store
        assert store["k_live_x"]["tenant_id"] == "acme"
        # No demo/hardcoded keys leak in.
        assert "demo-key" not in store
    finally:
        auth._api_key_store.cache_clear()


def test_check_decision_pdp(client):
    # Protect, then use /check as a PDP — no data revealed.
    p = client.post("/api/v1/protect", json={
        "data": "aGVsbG8=",  # base64 "hello"
        "policy": {"combination": "all", "conditions": [
            {"type": "role", "operator": "equals", "values": ["doctor"]}]},
        "actor": {"user_id": "sys"},
    })
    assert p.status_code == 200, p.text
    protected = p.json()["protected_data"]

    granted = client.post("/api/v1/check", json={
        "identity": {"role": "doctor"}, "protected_data": protected})
    assert granted.status_code == 200, granted.text
    assert granted.json()["allowed"] is True

    denied = client.post("/api/v1/check", json={
        "identity": {"role": "nurse"}, "protected_data": protected})
    d = denied.json()
    assert d["allowed"] is False and d["reason"] and "role" in d["failed"]


def test_explain_route(client):
    r = client.post("/api/v1/explain", json={
        "identity": {"role": "nurse"},
        "policy": {"combination": "all", "conditions": [
            {"type": "role", "operator": "equals", "values": ["doctor"]}]},
    })
    assert r.status_code == 200, r.text
    assert r.json()["allowed"] is False and r.json()["reason"]


def test_seal_route(client):
    r = client.post("/api/v1/seal", json={"data": "ZG9jdW1lbnQ="})  # "document"
    assert r.status_code == 200, r.text
    sealed = r.json()
    assert sealed["signature"] and sealed["data_hash"] and sealed["algorithm"]


def test_evidence_export_csv(client):
    # Generate some activity first.
    client.post("/api/v1/protect", json={
        "data": "eA==", "policy": {"conditions": []}, "actor": {"user_id": "exporter"}})
    r = client.get("/api/v1/evidence/export", params={"format": "csv"})
    assert r.status_code == 200, r.text
    assert "text/csv" in r.headers["content-type"]
    assert b"position" in r.content


def test_compliance_report_route(client):
    r = client.get("/api/v1/compliance/report", params={"framework": "GDPR"})
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["framework"] == "GDPR" and "controls" in report


def test_get_key_by_id(client):
    # GET /keys/{id} — closes v1 gap B6.
    gen = client.post("/api/v1/keys/generate", json={"type": "encryption", "owner": "getter"})
    assert gen.status_code == 200, gen.text
    key_id = gen.json()["key_id"]
    r = client.get(f"/api/v1/keys/{key_id}")
    assert r.status_code == 200, r.text
    key = r.json()
    assert key["key_id"] == key_id and key["public_key"] and key["type"] == "encryption"


def test_policy_evaluate(client):
    policy = {
        "conditions": [
            {"type": "role", "operator": "equals", "value": "doctor"},
            {"type": "department", "operator": "in", "value": ["cardiology"]},
        ],
        "combination": "all",
    }
    granted = client.post("/api/v1/policy/evaluate", json={
        "policy": policy,
        "identity": {"role": "doctor", "department": "cardiology"},
    })
    assert granted.status_code == 200, granted.text
    assert granted.json()["decision"] == "granted"

    denied = client.post("/api/v1/policy/evaluate", json={
        "policy": policy,
        "identity": {"role": "nurse", "department": "cardiology"},
    })
    assert denied.json()["decision"] == "denied"
    assert denied.json()["evaluated_conditions"]  # per-condition breakdown present


def test_openapi_available(client):
    assert client.get("/openapi.json").status_code == 200
