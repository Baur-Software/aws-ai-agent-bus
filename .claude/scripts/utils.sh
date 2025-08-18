#!/usr/bin/env bash

# Agent Mesh Utilities
# Simple operations for local memory management

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MEM_DIR="${MEM_DIR:-$ROOT_DIR/memory}"
DB_FILE="$MEM_DIR/kv.sqlite"
TIMELINE_FILE="$MEM_DIR/timeline.ndjson"

usage() {
    echo "Usage: $0 <command> [args...]"
    echo ""
    echo "KV Operations:"
    echo "  kv-set <key> <json_value>  - Store key-value pair"
    echo "  kv-get <key>               - Retrieve value by key"
    echo ""
    echo "Timeline Operations:"
    echo "  timeline-add <json_line>   - Append JSON line to timeline"
    echo "  timeline-tail [n]          - Show last n lines (default: 10)"
    echo ""
    echo "Examples:"
    echo "  $0 kv-set user.name '\"Alice\"'"
    echo "  $0 kv-get user.name"
    echo "  $0 timeline-add '{\"ts\":\"$(date -u +%FT%TZ)\",\"event\":\"test\"}'"
    echo "  $0 timeline-tail 5"
}

kv_set() {
    local key="$1"
    local value="$2"
    
    if [ -z "$key" ] || [ -z "$value" ]; then
        echo "Error: Both key and value are required"
        return 1
    fi
    
    if [ ! -f "$DB_FILE" ]; then
        echo "Error: KV database not found. Run 'setup.sh init' first."
        return 1
    fi
    
    # Validate JSON
    echo "$value" | jq . >/dev/null || {
        echo "Error: Value must be valid JSON"
        return 1
    }
    
    sqlite3 "$DB_FILE" \
        "INSERT INTO kv(key,value,updated_at) VALUES('$key','$value','$(date -u +%FT%TZ)') 
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;"
    
    echo "Set: $key = $value"
}

kv_get() {
    local key="$1"
    
    if [ -z "$key" ]; then
        echo "Error: Key is required"
        return 1
    fi
    
    if [ ! -f "$DB_FILE" ]; then
        echo "Error: KV database not found. Run 'setup.sh init' first."
        return 1
    fi
    
    sqlite3 -json "$DB_FILE" "SELECT key,value,updated_at FROM kv WHERE key='$key';"
}

timeline_add() {
    local line="$1"
    
    if [ -z "$line" ]; then
        echo "Error: JSON line is required"
        return 1
    fi
    
    # Validate JSON
    echo "$line" | jq . >/dev/null || {
        echo "Error: Line must be valid JSON"
        return 1
    }
    
    mkdir -p "$MEM_DIR"
    echo "$line" >> "$TIMELINE_FILE"
    echo "Added to timeline: $line"
}

timeline_tail() {
    local n="${1:-10}"
    
    if [ ! -f "$TIMELINE_FILE" ]; then
        echo "Timeline is empty"
        return 0
    fi
    
    tail -n "$n" "$TIMELINE_FILE" | jq .
}

main() {
    case "${1:-}" in
        kv-set)
            kv_set "$2" "$3"
            ;;
        kv-get)
            kv_get "$2"
            ;;
        timeline-add)
            timeline_add "$2"
            ;;
        timeline-tail)
            timeline_tail "$2"
            ;;
        help|--help|-h|"")
            usage
            ;;
        *)
            echo "Error: Unknown command: $1"
            usage
            exit 1
            ;;
    esac
}

main "$@"