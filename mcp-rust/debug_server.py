#!/usr/bin/env python3
"""
Debug MCP server to capture exactly what the MCP SDK client sends
"""
import sys
import json

def main():
    print("[DEBUG] MCP Debug Server Starting", file=sys.stderr)

    try:
        for line_num, line in enumerate(sys.stdin, 1):
            line = line.strip()
            if not line:
                continue

            print(f"[DEBUG] Line {line_num}: {line}", file=sys.stderr)

            try:
                request = json.loads(line)
                print(f"[DEBUG] Parsed JSON: {json.dumps(request, indent=2)}", file=sys.stderr)

                # Only respond to requests (messages with ID), not notifications
                if "id" in request:
                    print(f"[DEBUG] Request detected, sending response", file=sys.stderr)
                    response = {
                        "jsonrpc": "2.0",
                        "id": request.get("id"),
                        "result": {
                            "protocolVersion": "2025-06-18",
                            "capabilities": {"tools": {}},
                            "serverInfo": {"name": "debug-server", "version": "1.0.0"}
                        }
                    }
                    print(json.dumps(response))
                    sys.stdout.flush()
                else:
                    print(f"[DEBUG] Notification detected, no response needed", file=sys.stderr)

            except json.JSONDecodeError as e:
                print(f"[DEBUG] JSON Parse Error: {e}", file=sys.stderr)

    except Exception as e:
        print(f"[DEBUG] Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()