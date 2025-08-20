# Agent Mesh MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with AWS Agent Mesh infrastructure. This server enables AI assistants to manage key-value storage, artifacts, events, and workflows within an AWS-based agent mesh environment.

## Features

- **Key-Value Storage**: Store and retrieve data with TTL support via DynamoDB
- **Artifact Management**: Upload, download, and list artifacts in S3 buckets
- **Event Bus Integration**: Send events to AWS EventBridge
- **Timeline Management**: Access timeline events and data
- **Workflow Support**: Start and manage Step Functions workflows
- **Dual Interface**: Both stdio and HTTP server implementations

## Architecture

The server provides two implementations:

1. **`src/server.js`** - Standard MCP server using stdio transport (recommended)
2. **`src/http-server.js`** - HTTP-based MCP server for web integrations

## Prerequisites

- Node.js 18.x LTS or higher (18.x, 20.x LTS recommended)
- npm 8.0.0 or higher 
- AWS CLI configured or appropriate IAM permissions
- AWS resources deployed (DynamoDB table, S3 buckets, EventBridge bus)

## Quick Start

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd mcp-server
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your AWS resource names
   ```

3. **Start the server**:
   ```bash
   # Stdio server (for MCP clients)
   npm start
   
   # HTTP server (for web integrations)
   npm run start:http
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_PROFILE` | *(none)* | AWS profile to use (optional) |
| `AWS_REGION` | `us-west-2` | AWS region |
| `AGENT_MESH_ENV` | `dev` | Environment identifier |
| `AGENT_MESH_KV_TABLE` | `agent-mesh-kv` | DynamoDB table name |
| `AGENT_MESH_ARTIFACTS_BUCKET` | `agent-mesh-artifacts` | S3 bucket for artifacts |
| `AGENT_MESH_TIMELINE_BUCKET` | `agent-mesh-timeline` | S3 bucket for timeline data |
| `AGENT_MESH_EVENT_BUS` | `agent-mesh-events` | EventBridge event bus name |
| `PORT` | `3000` | HTTP server port |

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "agent-mesh": {
      "command": "node",
      "args": ["src/server.js"],
      "cwd": "/path/to/mcp-server",
      "env": {
        "AWS_REGION": "us-west-2",
        "AGENT_MESH_ENV": "prod",
        "AGENT_MESH_KV_TABLE": "your-kv-table",
        "AGENT_MESH_ARTIFACTS_BUCKET": "your-artifacts-bucket",
        "AGENT_MESH_EVENT_BUS": "your-event-bus"
      }
    }
  }
}
```

## Available Tools

### Key-Value Storage

#### `mesh_kv_get`
Retrieve a value from the key-value store.

**Parameters:**
- `key` (string): Key to retrieve

**Example:**
```json
{
  "key": "user-preferences",
  "value": "{\"theme\": \"dark\"}",
  "found": true
}
```

#### `mesh_kv_set`
Store a value in the key-value store with TTL.

**Parameters:**
- `key` (string): Key to store
- `value` (string): Value to store
- `ttl_hours` (number, optional): TTL in hours (default: 24)

### Artifact Management

#### `mesh_artifacts_list`
List artifacts in the artifacts bucket.

**Parameters:**
- `prefix` (string, optional): Filter by key prefix
- `max_keys` (number, optional): Maximum keys to return (default: 10)

#### `mesh_artifacts_get`
Retrieve an artifact's content.

**Parameters:**
- `key` (string): Artifact key/path

#### `mesh_artifacts_put`
Store an artifact.

**Parameters:**
- `key` (string): Artifact key/path
- `content` (string): Artifact content
- `content_type` (string, optional): MIME type (default: "text/plain")

### Event Management

#### `mesh_event_send`
Send an event to the event bus.

**Parameters:**
- `detail_type` (string): Event type
- `detail` (object): Event payload
- `source` (string, optional): Event source (default: "mcp-client")

#### `mesh_timeline_get`
Get timeline events.

**Parameters:**
- `prefix` (string, optional): Timeline prefix filter (default: "timeline/")
- `max_keys` (number, optional): Max events to return (default: 10)

### System Tools

#### `mesh_status`
Get current infrastructure status and configuration.

#### `mesh_workflow_start`
Start a Step Functions workflow (requires deployed workflow).

**Parameters:**
- `input` (object): Workflow input data
- `name` (string, optional): Execution name

## AWS Infrastructure Requirements

This server requires the following AWS resources:

1. **DynamoDB Table** for key-value storage:
   - Partition key: `key` (String)
   - TTL enabled on `expires_at` attribute

2. **S3 Buckets**:
   - Artifacts bucket for file storage
   - Timeline bucket for event data

3. **EventBridge Custom Bus** for event messaging

4. **IAM Permissions** for the execution role:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "dynamodb:GetItem",
           "dynamodb:PutItem",
           "dynamodb:Query"
         ],
         "Resource": "arn:aws:dynamodb:*:*:table/agent-mesh-*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::agent-mesh-*",
           "arn:aws:s3:::agent-mesh-*/*"
         ]
       },
       {
         "Effect": "Allow",
         "Action": [
           "events:PutEvents"
         ],
         "Resource": "arn:aws:events:*:*:event-bus/agent-mesh-*"
       }
     ]
   }
   ```

## Development

### Running in Development

```bash
# Start with file watching
npm run dev

# HTTP server with file watching
npm run dev:http
```

### Testing

You can test the server by starting it and connecting with an MCP client, or by using the HTTP server's health endpoint:

```bash
# Test HTTP server health endpoint
curl http://localhost:3000/health
```

## API Reference (HTTP Server)

When using the HTTP server, the following endpoints are available:

- `POST /mcp` - MCP protocol messages
- `GET /mcp` - Server-sent events for streaming
- `DELETE /mcp` - Close session
- `GET /health` - Health check

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "sessions": 3
}
```

## Troubleshooting

### Common Issues

1. **AWS Credentials Not Found**
   - Ensure AWS CLI is configured or environment variables are set
   - Check IAM permissions for required services

2. **Resource Not Found Errors**
   - Verify AWS resource names in environment variables
   - Ensure resources exist in the specified region

3. **Connection Issues**
   - Check network connectivity to AWS services
   - Verify security groups and VPC settings if running in EC2

4. **Permission Denied**
   - Review IAM policies and ensure proper permissions
   - Check resource-based policies on S3 buckets

### Debugging

Enable debug logging:

```bash
DEBUG=mcp:* npm start
```

Check AWS CloudWatch logs for detailed error information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review AWS service documentation
3. Open an issue on GitHub with detailed error information