# [System Name] - [Role]

> **Role**: [Primary purpose]
> **Host**: `[hostname]` ([IP address or localhost])
> **Hardware**: [Specs]
> **Critical Path**: [Yes/No] - [Explanation]

## Topology
| Direction | Connected To | Protocol | Purpose |
|-----------|--------------|----------|---------|
| ← Receives | [Source] | [Protocol:Port] | [Purpose] |
| → Sends | [Destination] | [Protocol:Port] | [Purpose] |

## Quick Health
```bash
[command to check if system is healthy]
[command to test integration]
```

## Key Processes
- `[process_name]`: [Description]
- `[process_name]`: [Description]

---
<!-- WARM CONTEXT ENDS ABOVE THIS LINE -->

## Full Documentation

### Quick Reference
- **Hostname**: [Full hostname]
- **IP**: [IP address or connection string]
- **Access**: [SSH command or access method]
- **OS**: [Operating system details]

## What's Deployed Here

| Component | Entry Point | Status |
|-----------|-------------|--------|
| **[Component 1]** | `[file.py]` | [Active/Inactive/Testing] |
| **[Component 2]** | `[file.py]` | [Active/Inactive/Testing] |

## Key Paths

**Code:**
```
/path/to/code/
├── [directory/]
│   ├── [important_file.py]
│   └── [config.yml]
└── [another_file.py]
```

**Data:**
```
/path/to/data/
├── [database.db]
└── [logs/]
```

## Services Running

**Check Status:**
```bash
[command to check service status]
```

**Start Service:**
```bash
[command to start service]
```

**Stop Service:**
```bash
[command to stop service]
```

## System Specifications

**Hardware:**
- **CPU**: [Specs]
- **RAM**: [Amount]
- **Storage**: [Amount and type]
- **Network**: [Connection type]

**Software:**
- **OS**: [Distribution and version]
- **Runtime**: [Python/Node/etc version]
- **Key Dependencies**: [Major libraries]

## Deployment

**Deploy from [source]:**
```bash
[deployment commands]
```

**After Deployment:**
```bash
[restart commands]
[validation commands]
```

## Health Checks

**Network:**
```bash
ping [hostname]
nc -zv [hostname] [port]
```

**Service:**
```bash
curl http://[hostname]:[port]/health
```

## Integration Points

### [Integration Name]

- **Caller**: `[file.py:line]`
- **Protocol**: [HTTP/gRPC/WebSocket/etc]
- **Latency**: [Expected latency]
- **Failure Mode**: [What happens if this fails]

**Example request:**
```bash
[curl or other command showing how to call this]
```

## Common Issues

**Issue:** [Description]
- **Symptom**: [How it manifests]
- **Fix**: [How to resolve]

---

**Last Updated:** [Date]
**Maintained By:** [Your name]
