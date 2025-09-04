# AWS AI Agent Bus Documentation

Welcome to the AWS AI Agent Bus documentation! This project provides a comprehensive infrastructure and toolset for building AI-powered agent systems on AWS.

## 🚀 Quick Start

- [**Setup Guide**](mcp-server/setup.md) - Get started with MCP Server setup
- [**Claude Integration**](CLAUDE.md) - Instructions for Claude Code integration
- [**Infrastructure Guide**](infra/README.md) - Terraform infrastructure overview

## 📚 Core Components

### MCP Server
The Model Context Protocol server provides AI assistants with AWS service access.

- [**API Reference**](mcp-server/api.md) - Complete API documentation
- [**Setup & Configuration**](mcp-server/setup.md) - Installation and configuration
- [**Integration Guide**](mcp-server/integration.md) - Integration patterns
- [**Examples**](mcp-server/examples.md) - Usage examples
- [**Google Analytics Setup**](mcp-server/google-analytics-setup.md) - Analytics integration

### Infrastructure 
Terraform modules for scalable AWS deployment organized by workspaces.

- [**Infrastructure Overview**](infra/) - Architecture and components
- **Workspaces**: [Small](infra/small/) | [Medium](infra/medium/) | [Large](infra/large/)
- **Integrations**: [Stripe](infra/integrations/stripe/) | [Supabase](infra/integrations/supabase/) | [Vercel](infra/integrations/vercel/)

### Agent System
Sophisticated agent orchestration with conductors, critics, and specialists.

- [**Agent Architecture**](agents/) - System overview
- [**Conductor Agent**](agents/conductor.md) - Goal-driven planner
- [**Critic Agent**](agents/critic.md) - Safety and verification
- [**Specialized Agents**](agents/specialized/) - Framework and service experts

## 🛠️ Development

### Core Commands

```bash
# MCP Server development
cd mcp-server
npm install
npm test                    # Run full test suite (100% pass rate)
npm start                   # Start MCP server

# Infrastructure deployment  
export WS=small/kv_store && export ENV=dev
npm run tf:apply           # Deploy infrastructure

# Google Analytics reports
npm run setup:ga-credentials     # Interactive setup
npm run report:users-by-country  # Live GA report
```

### Testing & Validation

```bash
# Run comprehensive test suite
npm test                   # MCP server tests
npm run tf:validate       # Infrastructure validation
act                       # GitHub Actions locally
```

## 📋 Architecture

```mermaid
graph TB
    subgraph "Agent Layer"
        C[Conductor Agent]
        R[Critic Agent] 
        S[Specialist Agents]
    end
    
    subgraph "MCP Server"
        M[MCP Protocol]
        A[AWS Services]
        G[Google Analytics]
    end
    
    subgraph "Infrastructure"
        SM[Small Workspaces]
        MD[Medium Workspaces]
        LG[Large Workspaces]
    end
    
    C --> M
    R --> M
    S --> M
    M --> A
    M --> G
    A --> SM
    A --> MD
    A --> LG
```

## 🔧 Environment Setup

### Required Environment Variables

```bash
# AWS Configuration  
export AWS_REGION=us-west-2
export AGENT_MESH_KV_TABLE=agent-mesh-kv
export AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts
export AGENT_MESH_EVENT_BUS=agent-mesh-events

# Infrastructure deployment
export WS=small/kv_store    # Workspace path
export ENV=dev              # Environment (dev/staging/prod)
```

## 🎯 Use Cases

- **AI Agent Orchestration**: Coordinate multiple AI agents for complex tasks
- **AWS Service Integration**: Seamless integration with DynamoDB, S3, EventBridge
- **Analytics & Reporting**: Google Analytics integration with automated reports
- **Infrastructure as Code**: Production-ready Terraform modules
- **Event-Driven Architecture**: Built on EventBridge for scalable event processing

## 🏗️ Infrastructure Costs

- **Small Workspaces**: ~$10/month (development)
- **Medium Workspaces**: ~$50-100/month (staging/small production)  
- **Large Workspaces**: ~$200-500/month (production with Aurora pgvector)

## 📖 Additional Resources

- [**Contributing Guide**](CONTRIBUTING.md) - How to contribute
- [**API Documentation**](api/) - Complete API reference
- [**Examples Repository**](examples/) - Sample implementations
- [**Troubleshooting Guide**](troubleshooting.md) - Common issues and solutions

---

*Generated with Claude Code - Your AI development companion*