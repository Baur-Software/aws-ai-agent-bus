# Integration: [Source] → [Destination]

**Purpose:** [What this integration does]
**Protocol:** [HTTP/gRPC/WebSocket/etc]
**Direction:** [Unidirectional/Bidirectional]
**Critical Path:** [Yes/No]

---

## Quick Reference

**Source:** `[source_file.py:line]`
**Destination:** [Service name] ([host:port])
**Client:** `[client_class_or_function]`

**Health Check:**
```bash
[command to verify integration is working]
```

---

## Integration Flow

```
[Source] → [Processing] → [Destination]
                ↓
        [Any middleware/transforms]
```

---

## Request Format

**Endpoint:** `[URL or method]`

**Request:**
```json
{
  "field1": "value",
  "field2": 123
}
```

**Response:**
```json
{
  "result": "value",
  "status": "success"
}
```

---

## Code Example

```python
# [Language]
from [module] import [client]

# Initialize
client = [Client]("[connection_string]")

# Make request
response = client.[method]({
    "param": "value"
})

# Handle response
if response.status == "success":
    return response.data
```

---

## Error Handling

**Failure Modes:**
- **Timeout**: [What happens] → [How to handle]
- **Connection Refused**: [What happens] → [How to handle]
- **Invalid Response**: [What happens] → [How to handle]

**Retry Strategy:**
```python
[retry logic if applicable]
```

---

## Performance

**Latency:**
- Typical: [ms]
- P95: [ms]
- P99: [ms]

**Throughput:**
- [requests/sec or similar metric]

**Bottlenecks:**
- [Known bottleneck 1]
- [Known bottleneck 2]

---

## Configuration

**Environment Variables:**
```bash
export [VAR_NAME]=[value]  # [Purpose]
```

**Connection String:**
```
[format of connection string]
```

---

## Testing

**Unit Test (Mock):**
```python
from unittest.mock import Mock

def test_integration():
    mock_client = Mock()
    mock_client.[method].return_value = {"status": "success"}
    # [test code]
```

**Integration Test (Live):**
```bash
[command to run integration test]
```

---

## Monitoring

**Check Health:**
```bash
[health check command]
```

**View Logs:**
```bash
[log viewing command]
```

**Metrics:**
- [Metric 1]: [How to view]
- [Metric 2]: [How to view]

---

## Recent Changes

**[Date]:**
- [Change description]
- [Impact on integration]

---

**Last Updated:** [Date]
**Maintained By:** [Your name]
