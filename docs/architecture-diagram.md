# AWS AI Agent Bus - Architecture Documentation

> **📄 Primary Diagram**: See [architecture-diagram.pdf](architecture-diagram.pdf) for the main visual architecture

This document provides detailed explanations of the components shown in the primary architecture diagram.

```mermaid
graph TB
    %% Value Proposition Header
    subgraph "🚀 Enhanced LLM Experience"
        ENHANCE[Better than basic LLM<br/>📊 Persistent context<br/>🔗 AWS integrations<br/>📈 Analytics & monitoring]
    end

    subgraph "🛡️ Responsible AI Governance"
        GOVERN[Enterprise-ready controls<br/>🔍 Event monitoring<br/>📋 Workflow validation<br/>🎯 Agent specialization]
    end

    %% Core MCP Enhancement Layer
    subgraph "🔌 MCP Enhancement Infrastructure"
        subgraph "Client Options"
            CC[Claude Code<br/>🤖 Direct LLM integration]
            DUI[Dashboard UI<br/>🖥️ Web-based control]
        end

        subgraph "Enhanced MCP Server"
            MCP[MCP Server<br/>Token persistence & context]

            subgraph "Value-Add Handlers"
                KVH[💾 Persistent Memory]
                AH[📦 Artifact Storage]
                EH[⚡ Event Processing]
                WH[🔄 Workflow Orchestration]
                GAH[📊 Analytics Integration]
                EMH[🔍 Event Monitoring]
            end
        end
    end

    %% Governance & Control Layer
    subgraph "🎯 AI Governance Layer"
        subgraph "Agent Oversight"
            COND[🎭 Conductors<br/>Task planning]
            CRIT[🛡️ Critics<br/>Safety validation]
            SPEC[⚙️ Specialists<br/>Domain expertise]
        end

        subgraph "Monitoring & Controls"
            MONITOR[📈 Real-time monitoring]
            AUDIT[📋 Audit trails]
            ALERTS[🚨 Governance alerts]
        end
    end

    %% Production Infrastructure
    subgraph "☁️ Production-Ready AWS Infrastructure"
        subgraph "Event-Driven Core"
            EB[EventBridge<br/>📡 Event bus]
            SF[Step Functions<br/>🔄 Workflows]
        end

        subgraph "Persistent Storage"
            DDB[(DynamoDB<br/>💾 Events, state, rules)]
            S3[(S3<br/>📦 Artifacts, results)]
            SM[(Secrets Manager<br/>🔐 Secure credentials)]
        end

        subgraph "Notifications"
            SNS[SNS<br/>📢 Alerts & notifications]
        end
    end

    %% External Enterprise Integrations
    subgraph "🔗 Enterprise Integrations"
        GA[📊 Google Analytics]
        STRIPE[💳 Stripe Payments]
        SLACK[💬 Slack Notifications]
        GITHUB[🔧 GitHub Integration]
    end

    %% Core Value Flow
    CC -->|Enhanced MCP Protocol| MCP
    DUI -->|Web Interface| MCP

    MCP -->|Persistent Context| KVH
    MCP -->|Event Governance| EH
    MCP -->|Workflow Control| WH

    EH -->|Governed Events| EB
    WH -->|Validated Workflows| SF

    EB -->|Monitored Events| DDB
    SF -->|Audit Trail| DDB

    %% Governance Flow
    COND -->|Task Oversight| MCP
    CRIT -->|Safety Validation| EH
    SPEC -->|Domain Expertise| MCP

    EH -->|Event Monitoring| MONITOR
    SF -->|Workflow Auditing| AUDIT
    DDB -->|Governance Alerts| ALERTS

    %% Infrastructure Connections
    KVH --> DDB
    AH --> S3
    GAH --> GA
    GAH --> SM
    EMH --> DDB
    ALERTS --> SNS

    %% Styling
    classDef valueProps fill:#4caf50,stroke:#2e7d32,stroke-width:3px,color:#fff
    classDef mcpLayer fill:#2196f3,stroke:#1565c0,stroke-width:2px,color:#fff
    classDef governance fill:#ff9800,stroke:#ef6c00,stroke-width:2px,color:#fff
    classDef infrastructure fill:#9c27b0,stroke:#6a1b9a,stroke-width:2px,color:#fff
    classDef integrations fill:#607d8b,stroke:#37474f,stroke-width:2px,color:#fff

    class ENHANCE,GOVERN valueProps
    class CC,DUI,MCP,KVH,AH,EH,WH,GAH,EMH mcpLayer
    class COND,CRIT,SPEC,MONITOR,AUDIT,ALERTS governance
    class EB,SF,DDB,S3,SM,SNS infrastructure
    class GA,STRIPE,SLACK,GITHUB integrations
```

## Why This Infrastructure Matters

### 🚀 Enhanced LLM Experience
**Beyond basic LLM interactions** - This infrastructure transforms standard LLM usage by adding:
- **Persistent Context**: Never lose conversation history or learned patterns
- **AWS Integrations**: Direct access to production systems and data
- **Analytics & Monitoring**: Real-time insights into LLM usage and performance
- **Multiple Interfaces**: Choose between Claude Code integration or web dashboard

### 🛡️ Responsible AI Governance
**Enterprise-ready AI controls** for production deployments:
- **Event Monitoring**: Track every AI action with full audit trails
- **Workflow Validation**: Ensure AI operations follow business rules
- **Agent Specialization**: Dedicated experts for different domains with safety controls
- **Real-time Alerts**: Immediate notifications for policy violations or errors

## Architecture Components

### 🔌 MCP Enhancement Infrastructure
**Making MCP better than basic LLM chat:**
- **Claude Code Client**: Enhanced LLM integration with AWS capabilities
- **Dashboard UI**: Web-based monitoring and control interface
- **Enhanced MCP Server**: Adds persistence, context, and enterprise features
- **Value-Add Handlers**: Memory, storage, events, workflows, analytics, monitoring

### 🎯 AI Governance Layer
**Responsible AI workflow management:**
- **Agent Oversight**: Conductors plan, Critics validate, Specialists execute
- **Monitoring & Controls**: Real-time monitoring, audit trails, governance alerts
- **Safety Validation**: Every operation validated before execution
- **Task Planning**: Structured approach to complex AI workflows

### ☁️ Production-Ready AWS Infrastructure
**Enterprise-grade foundation:**
- **Event-Driven Core**: EventBridge + Step Functions for reliable orchestration
- **Persistent Storage**: DynamoDB for state, S3 for artifacts, Secrets Manager for credentials
- **Notifications**: SNS for real-time alerts and governance notifications
- **Scalability**: Auto-scaling, multi-tenant, cost-optimized architecture

### 🔗 Enterprise Integrations
**Connect AI to your business systems:**
- **Analytics**: Google Analytics for usage insights
- **Payments**: Stripe for billing and payments
- **Communication**: Slack for team notifications
- **Development**: GitHub for code management
- **Extensible**: Framework for adding new integrations

## Key Value Propositions

1. **Better than Basic LLM**: Persistent memory, AWS integrations, analytics
2. **Responsible AI Governance**: Event monitoring, workflow validation, audit trails
3. **Enterprise Ready**: Production AWS infrastructure with proper security
4. **Developer Friendly**: Both Claude Code and web interfaces supported
5. **Cost Optimized**: Tiered workspace model scaling from $10/month to enterprise
6. **Extensible**: Framework for adding new agents, integrations, and capabilities