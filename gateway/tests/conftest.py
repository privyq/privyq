"""Gateway tests run against a live privyqd core and the real SDK."""
from __future__ import annotations

import os
import socket
import subprocess
import time
from pathlib import Path

import grpc
import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
CORE_DIR = REPO / "core-go"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_ready(address: str, timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with grpc.insecure_channel(address) as ch:
                grpc.channel_ready_future(ch).result(timeout=1)
                return
        except grpc.FutureTimeoutError:
            continue
    raise RuntimeError(f"core at {address} not ready")


@pytest.fixture(scope="session")
def client():
    go = os.environ.get("GO_BIN", "go")
    import tempfile

    tmp = Path(tempfile.mkdtemp())
    binary = tmp / "privyqd"
    subprocess.run(
        [go, "build", "-o", str(binary), "./cmd/privyqd"],
        cwd=CORE_DIR, check=True,
        env={**os.environ, "GOSUMDB": "off", "GOTOOLCHAIN": "local"},
    )
    port = _free_port()
    proc = subprocess.Popen(
        [str(binary)], env={**os.environ, "GRPC_PORT": str(port), "KEY_STORAGE": "memory"},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    address = f"localhost:{port}"
    try:
        _wait_ready(address)
        # Point the gateway/SDK at this core before the app builds its client.
        from app.config import settings
        from app.services import privyq_client

        settings.core_address = address
        privyq_client._configured = False
        import privyq

        privyq.configure(core_address=address)

        from app.main import app

        with TestClient(app) as c:
            yield c
    finally:
        proc.terminate()
        proc.wait(timeout=5)
