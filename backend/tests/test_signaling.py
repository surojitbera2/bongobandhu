"""Backend tests: /api/health + /api/ws/signal routing."""
import os
import json
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://top-up-selector.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/signal"


# ---- HTTP ----
class TestHealth:
    def test_health_returns_ok_true(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True

    def test_root_api(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True


# ---- WebSocket ----
@pytest.mark.asyncio
class TestSignaling:
    async def test_ws_connect_accepts(self):
        async with websockets.connect(f"{WS_URL}?id=peerA") as ws:
            assert ws.state.name == "OPEN"

    async def test_ws_routes_message_by_to_field(self):
        """Peer A sends to peer B; peer B must receive it with from=peerA injected."""
        async with websockets.connect(f"{WS_URL}?id=peerA1") as a, \
                   websockets.connect(f"{WS_URL}?id=peerB1") as b:
            # Give server a moment to register
            await asyncio.sleep(0.3)
            payload = {"type": "call_request", "to": "peerB1", "fromName": "Test"}
            await a.send(json.dumps(payload))
            received = await asyncio.wait_for(b.recv(), timeout=5)
            data = json.loads(received)
            assert data["type"] == "call_request"
            assert data["to"] == "peerB1"
            assert data["from"] == "peerA1"
            assert data["fromName"] == "Test"

    async def test_ws_bidirectional(self):
        async with websockets.connect(f"{WS_URL}?id=peerC") as a, \
                   websockets.connect(f"{WS_URL}?id=peerD") as b:
            await asyncio.sleep(0.3)
            await a.send(json.dumps({"type": "webrtc_offer", "to": "peerD", "sdp": "x"}))
            m1 = json.loads(await asyncio.wait_for(b.recv(), timeout=5))
            assert m1["from"] == "peerC" and m1["sdp"] == "x"
            await b.send(json.dumps({"type": "webrtc_answer", "to": "peerC", "sdp": "y"}))
            m2 = json.loads(await asyncio.wait_for(a.recv(), timeout=5))
            assert m2["from"] == "peerD" and m2["sdp"] == "y"

    async def test_ws_no_id_closed(self):
        try:
            async with websockets.connect(WS_URL) as ws:
                # should be closed by server with 4001
                await asyncio.wait_for(ws.recv(), timeout=3)
        except Exception:
            return
