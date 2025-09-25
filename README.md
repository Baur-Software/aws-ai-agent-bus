# AI Agent Bus

**Multi-tenant business process automation platform with live workflow execution, human-in-the-loop operations, and AI-powered agent generation.**

An intelligent workflow platform that combines automated processes with human decision points, featuring real-time execution monitoring and automatic integration discovery through MCP servers.

## What This Project Includes

A comprehensive workflow automation platform:

- **Live Workflow Registry**: Real-time execution state with visual node updates
- **Human-in-the-Loop Nodes**: People as first-class workflow participants with smart notifications
- **Auto-Generated AI Agents**: Automatic specialist agent creation from connected MCP servers
- **Multi-Tenant Agent Storage**: Organization and user-scoped agent management with S3/IAM security
- **Integration Discovery**: Connect apps and auto-populate workflow capabilities
- **Visual Canvas**: Drag-and-drop interface for designing mixed human/automated processes

**Current Capabilities:**

- **Multi-Tenant Agent System**: Organization and user-scoped AI agents with S3 path-based security
- **Live Workflow Execution**: Real-time node state updates via event streams
- **Human Workflow Nodes**: People as workflow participants with customizable notification preferences
- **MCP Integration Discovery**: Auto-populate workflow nodes from connected MCP servers
- **Specialist Agent Auto-Generation**: Create specialized agents from MCP server capabilities
- **Visual Canvas Design**: Drag-and-drop interface for mixed human/automated processes
- **Versioned Agent Storage**: Full CRUD operations with S3 versioning and DynamoDB metadata

## Architecture

### Core Components

- **Dashboard UI** (SolidJS): Visual workflow designer with live execution monitoring
- **Dashboard Server** (Node.js): WebSocket-based pub/sub backend with multi-tenant agent management
- **MCP Server** (Node.js): Model Context Protocol server providing AI context and tool execution
- **Internal MCP Registry**: Versioned registry of connected MCP servers with fork support
- **Multi-Tenant Agent Storage**: S3/DynamoDB-backed agent system with path-based security
- **Live Workflow Engine**: Real-time execution state management with event streaming
- **Human Notification System**: Multi-channel notifications (Slack, email, SMS) for human workflow nodes

### Data Architecture

**Agent Storage**:
```
S3: agents/
├── public/system/              # Bootstrap agents from .claude/agents
├── public/community/           # Community-shared agents
├── organizations/{orgId}/
│   ├── shared/                # Org-wide agents
│   ├── generated/{mcpId}/     # Auto-generated from MCP servers
│   └── users/{userId}/        # User private agents within org
└── users/{userId}/            # Individual user agents
```

**Multi-Tenant Context**:
- **Organizations**: Multiple users, shared resources, admin controls
- **Users**: Individual workspaces, private agents, personal integrations
- **MCP Tenant Isolation**: Each user/org has isolated MCP server context

### Technical Stack

- Frontend: SolidJS with TypeScript
- Backend: Node.js MCP server with stdio/HTTP interfaces
- Infrastructure: AWS (DynamoDB, S3, EventBridge, Step Functions)
- AI Integration: OpenAI/Claude via MCP protocol

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/aws-ai-agent-bus
cd aws-ai-agent-bus

# Start the dashboard UI
cd dashboard-ui
npm install
npm run dev

# Start the MCP server (separate terminal)
cd ../mcp-server
npm install
npm start
```

### 2. Try the Interface

Open http://localhost:5173 to access:

1. **Visual Canvas**: Design workflows with drag-and-drop
2. **Business Templates**: Pre-built process flows
3. **Chat Assistant**: Get AI suggestions (currently mock responses)
4. **Process Library**: Browse and manage your workflows

### 3. Deploy Infrastructure (Optional)

```bash
# Deploy AWS components for MCP server
export WS=small/kv_store ENV=dev
npm run tf:init
npm run tf:apply
```

## Use Cases

### **Human-in-the-Loop Operations**

**Financial Approval Workflows**:
```
API Request → Data Validation → Human Approval → Payment Processing → Notification
    🤖             🤖               👤                🤖               🤖
```
- Finance manager gets Slack notification for payments >$10k
- Mobile-friendly approval with full context
- Automatic escalation if no response within 2 hours

**Customer Onboarding with Review**:
```
Form Submission → Data Enrichment → Compliance Check → Manual Review → Account Creation
      🤖               🤖               🤖             👤              🤖
```
- Compliance officer reviews flagged applications
- Customizable notification preferences per person
- Real-time workflow state visible to all stakeholders

### **Auto-Generated Integration Workflows**

**Connect Stripe → Instant Specialized Agents**:
1. User connects Stripe MCP server to tenant context
2. System auto-generates: `stripe-payments-expert`, `stripe-webhooks-specialist`, `stripe-subscriptions-manager`
3. Workflow nodes populate with Stripe capabilities
4. Pre-built payment processing workflows become available

**GitHub Integration → Development Workflows**:
1. Connect GitHub MCP server
2. Auto-generate: `github-pr-manager`, `github-deployment-specialist`, `github-issue-tracker`
3. CI/CD workflow templates with human review gates
4. Automatic agent updates when MCP server versions change

### **Multi-Tenant Agent Management**

**Organization-Level Sharing**:
- `acme-corp` creates custom `salesforce-lead-qualifier` agent
- Available to all `acme-corp` users in workflow designer
- Version controlled with change logs

**Personal Agent Development**:
- Individual users create private specialized agents
- Fork organization agents for personal customization
- Markdown editor with live preview and templates

## Project Status

**✅ Implemented:**

- **Multi-Tenant Agent Storage**: S3/DynamoDB with path-based security and versioning
- **Agent CRUD Operations**: Full create, read, update, delete with AWS SDK integration
- **S3 Security Architecture**: IAM policies supporting user/org/public agent isolation
- **Frontmatter Parsing**: Markdown agent definitions with YAML metadata extraction
- **Version Management**: Automatic versioning for agent updates with changelog support

**🚧 In Development:**

- **Feature Flag Authentication**: Dev user injection (`user-demo-123`/`acme`) for immediate testing
- **WebSocket Agent Operations**: Pub/sub message handlers for real-time agent management
- **Internal MCP Registry**: Versioned registry with fork support and tenant context
- **Auto-Agent Generation**: Specialist agent creation from connected MCP server capabilities
- **Live Workflow Execution**: Real-time node state updates with event streaming
- **Human Workflow Nodes**: People as workflow participants with smart notifications

**🎯 Planned:**

- **Markdown Agent Editor**: Universal editor with templates, live preview, syntax highlighting
- **MCP Server Discovery**: Integration with mcpservers.org for app connection workflows
- **Mobile Notifications**: Multi-channel human node notifications (Slack, SMS, email)
- **Production Authentication**: AWS Cognito integration with JWT-based user context
- **Workflow Marketplace**: Published workflow sharing and discovery

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and setup instructions.

## Documentation

- [`CODEBASE_STRUCTURE.md`](CODEBASE_STRUCTURE.md) - Complete codebase overview and architecture
- [`mcp-server/`](mcp-server/README.md) - MCP server documentation
- [`.claude/`](.claude/README.md) - Agent orchestration system
- [`infra/`](infra/) - Terraform infrastructure modules

## Contributing

See [CONTRIBUTING.md](mcp-server/CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](mcp-server/LICENSE) for details.
