"""Full-stack integration fixtures: a testcontainers Postgres + the real core +
the Python SDK pointed at it (ARCH §23.2). Closes the v1 gap where
tests/integration/ was empty and no testcontainers were used."""

from __future__ import annotations

import os
import socket
import subprocess
import time
from pathlib import Path

import grpc
import pytest
from testcontainers.postgres import PostgresContainer

REPO = Path(__file__).resolve().parents[2]
CORE_DIR = REPO / "core-go"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_ready(address: str, timeout: float = 25.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with grpc.insecure_channel(address) as ch:
                grpc.channel_ready_future(ch).result(timeout=1)
                return
        except grpc.FutureTimeoutError:
            continue
    raise RuntimeError(f"core at {address} did not become ready")


def _pgx_dsn(pg: PostgresContainer) -> str:
    # testcontainers returns e.g. postgresql+psycopg2://user:pass@host:port/db
    after = pg.get_connection_url().split("://", 1)[1]
    return "postgres://" + after + "?sslmode=disable"


@pytest.fixture(scope="session")
def stack(tmp_path_factory):
    """Build privyqd, start Postgres, run the core against it, point the SDK at it."""
    go = os.environ.get("GO_BIN", "go")
    binary = tmp_path_factory.mktemp("bin") / "privyqd"
    subprocess.run(
        [go, "build", "-o", str(binary), "./cmd/privyqd"],
        cwd=CORE_DIR, check=True,
        env={**os.environ, "GOSUMDB": "off", "GOTOOLCHAIN": "local"},
    )
    with PostgresContainer("postgres:16") as pg:
        dsn = _pgx_dsn(pg)
        port = _free_port()
        proc = subprocess.Popen(
            [str(binary)],
            env={**os.environ, "GRPC_PORT": str(port), "DB_URL": dsn, "KEY_STORAGE": "memory"},
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        address = f"localhost:{port}"
        try:
            _wait_ready(address)
            import privyq
            privyq.configure(core_address=address)
            yield privyq
        finally:
            proc.terminate()
            proc.wait(timeout=5)
            from privyq import client
            client.reset_default_client()
