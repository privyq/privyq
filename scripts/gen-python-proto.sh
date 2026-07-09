#!/usr/bin/env bash
# Regenerate the Python gRPC stubs from the frozen proto contract into the SDK.
# Requires: pip install grpcio-tools
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/sdk-python/privyq/_proto"
mkdir -p "$OUT"
touch "$OUT/__init__.py"
python -m grpc_tools.protoc \
  --proto_path="$ROOT/core-go/pkg/proto" \
  --python_out="$OUT" \
  --grpc_python_out="$OUT" \
  "$ROOT/core-go/pkg/proto/privyq.proto"
# Fix the intra-package import so `privyq_pb2_grpc` finds `privyq_pb2`.
sed -i 's/^import privyq_pb2 as/from . import privyq_pb2 as/' "$OUT/privyq_pb2_grpc.py"
echo "Python stubs written to $OUT"
