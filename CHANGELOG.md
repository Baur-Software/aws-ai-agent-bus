# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CHANGELOG.md file for tracking changes

### Changed
- Updated workspace tier cost estimates to match infrastructure documentation
- Restricted CloudWatch Logs IAM policy to specific log group (security fix)

### Security
- Fixed overly permissive CloudWatch Logs IAM policy (`resources = ["*"]` -> specific ARN)

## [2.1.0] - 2026-01-07

### Added
- Comprehensive CONTRIBUTING.md with development guidelines (#17)
- SECURITY.md with vulnerability reporting process (#20)
- MCP-Rust documentation (API, Architecture, Deployment, Migration guides)
- SNS integration for notifications (#16)
- Wait-for-server retry logic in CI for flaky test prevention (#24)
- Terraform plugin cache to prevent CI disk space exhaustion (#22)

### Changed
- Migrated from Node.js MCP server to Rust implementation (#21)
- Updated docker-compose.test.yml to reference mcp-rust (#20)

### Fixed
- Replaced hardcoded demo-user IDs with auth context (#23)
- Implemented event rule actions (SNS, webhook, workflow triggers) (#19)
- Removed all 9 skipped tests in dashboard-ui (#15)
- Removed hardcoded JWT secret fallback, require JWT_SECRET in production (#13)
- Fixed useAutoSave race condition to prevent data loss (#12)

### Security
- Multi-agent security hardening (#16)
- Store integration credentials in AWS Secrets Manager instead of DynamoDB (#10)
- Password validation UI components with strength indicators (#16)
- AES-256-GCM encryption for credentials (#16)

## [2.0.0] - 2026-01-01

### Added
- Full infrastructure as code with Terraform workspaces (extra-small, small, medium, large)
- MCP Rust server implementation with multi-tenant support
- Dashboard UI with SolidJS
- Dashboard Server with WebSocket-first architecture
- Google Analytics integration
- AWS Bedrock chat integration
- Yjs workflow persistence to DynamoDB/S3 (#9)
- Feature flags system (#4)
- AI-powered workflow generation with persistent chat history

### Changed
- Reorganized documentation into structured folders
- Made getServerForTool data-driven instead of giant if-statement
- Converted dashboard-server reports to TypeScript (#7)

### Fixed
- Tool routing for kv_*, events_*, artifacts_* to aws MCP server
- Dark mode hover class in SidebarSettings
- Chat service and uploads issues

## [1.0.0] - Initial Release

### Added
- Initial Agent Mesh MCP Server
- Core AWS integrations (DynamoDB, S3, EventBridge, Secrets Manager)
- Basic workflow execution engine
- Multi-tenant architecture foundation
