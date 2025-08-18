#!/usr/bin/env bash
set -euo pipefail

# Agent Mesh Setup Script
# Consolidates initialization and configuration tasks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MEM_DIR="$ROOT_DIR/memory"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

usage() {
    echo "Usage: $0 [init|config|help]"
    echo ""
    echo "Commands:"
    echo "  init    - Initialize memory structures and directories"
    echo "  config  - Update configuration with environment variables"
    echo "  help    - Show this help message"
    echo ""
    echo "Environment variables (set in .env):"
    echo "  AWS_PROFILE, AWS_REGION, MCP_SERVER_URL, MCP_AUTH_TOKEN"
}

init_memory() {
    echo -e "${GREEN}Initializing memory structures...${NC}"
    
    # Create directories
    mkdir -p "$MEM_DIR/snapshots"
    
    # Initialize timeline
    [ -f "$MEM_DIR/timeline.ndjson" ] || touch "$MEM_DIR/timeline.ndjson"
    
    # Initialize SQLite KV store
    if [ ! -f "$MEM_DIR/kv.sqlite" ]; then
        if command -v sqlite3 >/dev/null 2>&1; then
            sqlite3 "$MEM_DIR/kv.sqlite" <<'SQL'
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS meta (
  name TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR IGNORE INTO meta(name,value) VALUES('schema_version','1');
SQL
            echo -e "${GREEN}Created SQLite KV store${NC}"
        else
            echo -e "${YELLOW}SQLite3 not found. Skipping local KV store creation.${NC}"
            echo -e "${YELLOW}Consider using MCP server KV operations instead.${NC}"
        fi
    fi
    
    echo -e "${GREEN}Memory initialized at $MEM_DIR${NC}"
}

update_config() {
    echo -e "${GREEN}Updating configuration...${NC}"
    
    CONFIG_FILE="$ROOT_DIR/mesh-agent-config.json"
    
    # Load environment variables from .env if it exists
    if [ -f "$ROOT_DIR/.env" ]; then
        set -a
        source "$ROOT_DIR/.env"
        set +a
        echo -e "${GREEN}Loaded environment from .env${NC}"
    else
        echo -e "${YELLOW}No .env file found. Using system environment variables.${NC}"
    fi
    
    # Check required tools
    if ! command -v jq >/dev/null 2>&1; then
        echo -e "${RED}jq is required but not installed.${NC}"
        echo -e "${YELLOW}Please install jq to continue.${NC}"
        return 1
    fi
    
    # Set defaults if not provided
    MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3000}"
    AWS_REGION="${AWS_REGION:-us-west-2}"
    
    # Validate required variables
    if [ -z "${AWS_PROFILE:-}" ]; then
        echo -e "${RED}AWS_PROFILE environment variable is required${NC}"
        echo -e "${YELLOW}Set it in .env or your shell environment${NC}"
        return 1
    fi
    
    # Update config file
    TEMP_CONFIG=$(mktemp)
    jq --arg url "$MCP_SERVER_URL" \
       --arg token "${MCP_AUTH_TOKEN:-}" \
       --arg profile "$AWS_PROFILE" \
       --arg region "$AWS_REGION" \
       '.mcpServers[0].url = $url | 
        (.mcpServers[0].authorization_token = $token | select($token != "")) |
        .aws.profile = $profile |
        .aws.region = $region' \
       "$CONFIG_FILE" > "$TEMP_CONFIG"
    
    mv "$TEMP_CONFIG" "$CONFIG_FILE"
    echo -e "${GREEN}Configuration updated${NC}"
    
    # Show current config
    echo -e "\n${YELLOW}Current configuration:${NC}"
    echo -e "  MCP Server: $MCP_SERVER_URL"
    echo -e "  AWS Profile: $AWS_PROFILE"
    echo -e "  AWS Region: $AWS_REGION"
    echo -e "  Config file: $CONFIG_FILE"
}

main() {
    case "${1:-help}" in
        init)
            init_memory
            ;;
        config)
            update_config
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            echo -e "${RED}Unknown command: ${1:-}${NC}"
            usage
            exit 1
            ;;
    esac
}

main "$@"