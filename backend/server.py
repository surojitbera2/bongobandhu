#!/usr/bin/env python3
"""
Wrapper to start the Node.js backend from the Python backend supervisor process.
The actual application logic is in /app/node-backend/server.js
"""
import subprocess
import os
import sys
from pathlib import Path

# Set up environment
node_backend_dir = Path(__file__).parent.parent / "node-backend"
os.chdir(node_backend_dir)

# Start Node.js backend
print(f"Starting Node.js backend from {node_backend_dir}", flush=True)
sys.stdout.flush()

process = subprocess.Popen(
    ["node", "server.js"],
    cwd=str(node_backend_dir),
    stdout=sys.stdout,
    stderr=sys.stderr,
    env=os.environ
)

try:
    process.wait()
except KeyboardInterrupt:
    print("Shutting down Node.js backend...", flush=True)
    process.terminate()
    process.wait()
