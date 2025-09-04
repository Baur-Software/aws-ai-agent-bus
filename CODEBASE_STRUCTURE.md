# AWS AI Agent Bus - Codebase Structure

## Overview
This project implements a comprehensive AWS-based AI agent mesh with Google Analytics integration using the Model Context Protocol (MCP).

## Directory Structure

```
aws-ai-agent-bus/
├── mcp-server/                    # Main MCP server implementation
│   ├── src/
│   │   ├── modules/
│   │   │   ├── aws/              # AWS service integrations
│   │   │   │   ├── clients.js    # Centralized AWS client configuration
│   │   │   │   ├── dynamodb.js   # DynamoDB operations
│   │   │   │   ├── event-bridge.js # EventBridge messaging
│   │   │   │   ├── s3.js         # S3 artifact storage
│   │   │   │   └── step-functions.js # Workflow orchestration
│   │   │   └── mcp/              # MCP protocol implementation
│   │   │       ├── handlers/     # MCP tool handlers
│   │   │       │   ├── artifacts.js      # Artifact management
│   │   │       │   ├── events.js         # Event publishing
│   │   │       │   ├── google-analytics.js # GA integration
│   │   │       │   ├── kv.js             # Key-value storage
│   │   │       │   └── workflow.js       # Workflow management
│   │   │       └── server.js     # MCP server implementation
│   │   ├── services/
│   │   │   └── google-analytics.js # Google Analytics API client
│   │   ├── reports/               # Analytics reports and utilities
│   │   │   ├── users-by-country.js     # Users by country report
│   │   │   ├── users-by-country-sample.js # Sample data version
│   │   │   ├── index.js                # Reports module exports
│   │   │   └── README.md              # Reports documentation
│   │   ├── scripts/               # Setup and utility scripts
│   │   │   └── setup-ga-credentials.js # Interactive GA credentials setup
│   │   ├── http-server.js         # HTTP interface for MCP
│   │   └── server.js             # Main MCP server entry
│   ├── docs/                      # Documentation
│   │   └── google-analytics-setup.md  # Comprehensive GA setup guide
│   └── test/                     # Test suites
│       ├── unit/                 # Unit tests
│       ├── integration/          # Integration tests
│       └── ga-oauth2-simple.test.mjs # OAuth2 validation
├── infra/                        # Terraform infrastructure
│   ├── modules/                  # Reusable Terraform modules
│   └── workspaces/              # Environment-specific configurations
└── .claude/                     # Claude Code configuration
    └── agents/                  # Specialized agent definitions
```

## Key Components

### MCP Server (`mcp-server/`)
- **Purpose**: Implements Model Context Protocol for AI agent interactions
- **Key Features**: 
  - Google Analytics integration with OAuth2 support
  - AWS service orchestration (DynamoDB, S3, EventBridge, Step Functions)
  - Event-driven architecture
  - Comprehensive test coverage (100% pass rate)

### AWS Integrations (`src/modules/aws/`)
- **DynamoDB**: Key-value storage for agent state
- **S3**: Artifact and file storage
- **EventBridge**: Inter-service messaging
- **Step Functions**: Workflow orchestration

### Google Analytics Integration (`src/services/google-analytics.js`)
- **OAuth2 Flow**: Complete authentication implementation
- **API Coverage**: Analytics Data API and Search Console API
- **Features**:
  - Top pages analysis
  - Search Console data retrieval
  - Content opportunity analysis
  - Automated content calendar generation

### Analytics Reports (`src/reports/`)
- **Purpose**: Pre-built analytics reports for common use cases
- **Features**:
  - Users by country analysis with geographic insights
  - Sample data versions for testing without credentials
  - Comprehensive error handling and troubleshooting
  - Integration with existing Google Analytics service
- **Scripts**: 
  - `npm run setup:ga-credentials` - Interactive credential setup with AWS Secrets Manager
  - `npm run report:users-by-country` - Live data report
  - `npm run report:users-by-country-sample` - Demo with sample data

### Documentation & Setup (`docs/`, `scripts/`)
- **Comprehensive Setup Guide**: Complete OAuth2 flow and AWS Secrets Manager integration
- **Interactive Scripts**: Automated credential setup and testing
- **Security Best Practices**: Token rotation, IAM policies, and monitoring guidance

## Testing Strategy

### Test Coverage: 100% Pass Rate
- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow validation
- **OAuth2 Tests**: Authentication flow verification
- **Mock Strategy**: Comprehensive AWS and Google API mocking

### Key Test Files
- `test/ga-oauth2-simple.test.mjs`: OAuth2 credential validation
- `test/unit/google-analytics.test.mjs`: GA handler unit tests  
- `test/integration/google-analytics-mcp.test.mjs`: Full workflow tests

## Development Patterns

### Clean Architecture
- **Separation of Concerns**: Clear module boundaries
- **Dependency Injection**: Configurable service clients
- **Error Handling**: Graceful degradation with proper logging
- **Environment Awareness**: Test-specific behavior switches

### Code Quality Standards
- **ES6 Modules**: Modern JavaScript module system
- **JSDoc Comments**: Comprehensive API documentation
- **Error Boundaries**: Robust error handling throughout
- **Mock-Friendly**: Designed for testability

## Getting Started

1. **Setup**: `npm install` in `mcp-server/`
2. **Test**: `npm test` (validates 100% pass rate)
3. **Run**: `npm start` or `npm run dev`
4. **Infrastructure**: Use Terraform modules in `infra/`

## Architecture Principles

1. **Event-Driven**: All major operations publish events via EventBridge
2. **Stateless**: Services maintain minimal state, rely on external storage
3. **Testable**: Full mock coverage enables reliable CI/CD
4. **Scalable**: AWS-native architecture supports horizontal scaling
5. **Observable**: Comprehensive logging and event tracking