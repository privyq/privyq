"""Test fixtures: build and run the real privyqd core, point the SDK at it."""

from __future__ import annotations

import os
import socket
import subprocess
import time
from pathlib import Path

import grpc
import pytest

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
    raise RuntimeError(f"core at {address} did not become ready")


@pytest.fixture(scope="session")
def core_address(tmp_path_factory):
    """Build privyqd and run it on a free port with in-memory storage."""
    go = os.environ.get("GO_BIN", "go")
    binary = tmp_path_factory.mktemp("bin") / "privyqd"
    subprocess.run(
        [go, "build", "-o", str(binary), "./cmd/privyqd"],
        cwd=CORE_DIR,
        check=True,
        env={**os.environ, "GOSUMDB": "off", "GOTOOLCHAIN": "local"},
    )
    port = _free_port()
    proc = subprocess.Popen(
        [str(binary)],
        env={**os.environ, "GRPC_PORT": str(port), "KEY_STORAGE": "memory"},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    address = f"localhost:{port}"
    try:
        _wait_ready(address)
        yield address
    finally:
        proc.terminate()
        proc.wait(timeout=5)


@pytest.fixture()
def configured(core_address):
    import privyq

    privyq.configure(core_address=core_address)
    yield privyq
    from privyq import client

    client.reset_default_client()
