# Agent Storage Architecture

## DynamoDB Table: Agents

| Field        | Type      | Description                                 |
|------------- |---------- |---------------------------------------------|
| agentId      | String    | Primary key, unique agent identifier        |
| ownerType    | String    | 'organization' or 'user'                    |
| ownerId      | String    | Organization ID or User ID                  |
| name         | String    | Agent display name                          |
| description  | String    | Agent description                           |
| s3Path       | String    | S3 path to markdown file                    |
| createdAt    | ISODate   | Creation timestamp                          |
| updatedAt    | ISODate   | Last update timestamp                       |
| permissions  | Object    | Read/write/share permissions                |
| version      | Number    | Current version number                      |
| tags         | [String]  | Optional tags for filtering                 |

## S3 Storage Structure

- Bucket: `agent-definitions`
- Organization agents: `org/{orgId}/agents/{agentId}/v{version}.md`
- User agents: `user/{userId}/agents/{agentId}/v{version}.md`
- Each agent definition is a markdown file, versioned by incrementing `v{version}`.

## Dashboard-Server Event API

- `agent.list` (org/user context)
- `agent.create` (upload markdown, create metadata)
- `agent.update` (update markdown, increment version)
- `agent.delete`
- `agent.get` (fetch agent details and markdown)

## UI Integration

- Markdown editor for agent creation/editing
- CRUD operations via dashboard-server events
- MCP queries dashboard-server for agent lists

---
This document describes the agent storage and ownership architecture for multi-tenant agent management, versioned markdown definitions in S3, and CRUD operations via dashboard-server.
