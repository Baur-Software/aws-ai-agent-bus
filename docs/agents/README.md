---
layout: page
title: Agent System
permalink: /agents/
---

## AWS AI Agent Bus - Agent System

The AWS AI Agent Bus includes a sophisticated agent orchestration system designed to provide specialized AI capabilities across different domains. The system uses a distributed architecture with multiple specialized agents working together.

## Core Agent Types

### System Orchestration Agents

#### Conductor Agent

- **Role**: Goal-driven planner and delegator
- **Capabilities**: Breaks down complex tasks, coordinates multiple agents, manages workflows
- **Location**: `.claude/agents/conductor.md`

#### Critic Agent

- **Role**: Safety and verification agent
- **Capabilities**: Code review, security analysis, quality assurance, compliance checking
- **Location**: `.claude/agents/critic.md`

#### Mentor Agent

- **Role**: Finds latest documentation and teaches agents new methods
- **Capabilities**: Knowledge discovery, documentation updates, agent training
- **Location**: `.claude/agents/mentor.md`

### Framework Specialists

#### Frontend Experts

- **React Specialist**: React/Next.js development and optimization
- **Vue Specialist**: Vue.js/Nuxt development and state management
- **SolidJS Specialist**: SolidJS reactive frontend development

#### Backend Experts

- **Django Expert**: Django ORM and backend development
- **Laravel Expert**: Laravel Eloquent and PHP backend systems
- **Rails Expert**: Ruby on Rails ActiveRecord and API development
- **Node.js Expert**: TypeScript/JavaScript backend services

### AWS Cloud Specialists

#### Storage & Data

- **S3 Expert**: Object storage, lifecycle management, CDN integration
- **DynamoDB Expert**: NoSQL database design, GSI optimization, DAX caching
- **RDS Expert**: Relational database management, Aurora clusters

#### Compute & Orchestration

- **Lambda Expert**: Serverless functions, event-driven architecture
- **EKS Expert**: Kubernetes orchestration, container management
- **ECS Expert**: Container services, task definitions, service mesh

#### Security & Access

- **IAM Expert**: Identity and access management, policy optimization
- **Secrets Manager Expert**: Credential management, rotation policies
- **WAF Expert**: Web application firewall, DDoS protection

#### Messaging & Events

- **SQS Expert**: Queue management, dead letter queues, FIFO queues
- **SNS Expert**: Notification services, topic management, subscriptions
- **EventBridge Expert**: Event routing, custom event buses, rules

#### Monitoring & Analytics

- **CloudWatch Expert**: Metrics, logs, alarms, dashboards
- **CloudTrail Expert**: Audit logging, compliance, security monitoring

### Integration Specialists

#### Payment & Commerce

- **Stripe Expert**: Payment processing, subscription management, webhooks

#### Communication

- **Slack Expert**: Bot development, workspace integration, automation
- **GitHub Expert**: Repository management, CI/CD, issue tracking

#### Deployment & Infrastructure

- **Vercel Expert**: Frontend deployment, edge functions, domain management
- **Terraform Expert**: Infrastructure as code, state management, modules

## Agent Architecture

### Memory System

- **KV Store**: Agent state persistence and user connection management
- **Timeline**: Event tracking and workflow history
- **Vector Embeddings**: Contextual memory for improved decision making

### Communication Patterns

- **Event-Driven**: All major operations publish EventBridge events
- **Stateless Services**: Minimal state, external storage via DynamoDB/S3
- **Clean Error Handling**: Graceful degradation with proper logging

### Integration System

#### Connection Architecture

Agents can manage multiple connections per service:

```bash
# App configuration (shared template)
integration-google-analytics  # OAuth2 config, UI fields, workflow capabilities

# User connections (individual, encrypted credentials)
user-demo-user-123-integration-google-analytics-default     # Default connection
user-demo-user-123-integration-google-analytics-work        # Work account
user-demo-user-123-integration-google-analytics-personal    # Personal account
```

#### Workflow Integration

- **Node Filtering**: Workflow nodes become available when ANY connection exists for required service
- **Legacy Support**: Automatic migration from old connection patterns
- **Dynamic Detection**: WorkflowBuilder checks both legacy and new connection patterns

## Usage Patterns

### Task Delegation

The Conductor agent receives high-level goals and delegates specific tasks to appropriate specialists:

1. **Planning Phase**: Conductor analyzes requirements and creates execution plan
2. **Delegation Phase**: Tasks assigned to relevant domain experts
3. **Coordination Phase**: Progress monitoring and inter-agent communication
4. **Verification Phase**: Critic agent reviews outputs for quality and security

### Quality Assurance

Every agent output is subject to review by the Critic agent:

- **Code Review**: Syntax, best practices, security vulnerabilities
- **Infrastructure Review**: Cost optimization, security compliance, scalability
- **Integration Review**: API compatibility, error handling, monitoring

### Knowledge Management

The Mentor agent ensures all agents stay current:

- **Documentation Updates**: Syncs with latest service documentation
- **Best Practice Sharing**: Distributes lessons learned across agents
- **Capability Enhancement**: Teaches new methods and techniques

## Getting Started

### Agent Configuration

Agents are configured through the `.claude/agents/` directory with individual markdown files defining:

- **Capabilities**: What the agent can do
- **Tools**: Available integrations and APIs
- **Patterns**: Common usage scenarios
- **Examples**: Sample interactions and outputs

### Deployment

Agents run within the MCP (Model Context Protocol) server environment:

- **Rust Runtime**: High-performance execution environment
- **AWS Integration**: Direct access to AWS services via SDK
- **Event Processing**: Real-time event handling and response

### Monitoring

Agent performance and interactions are tracked through:

- **CloudWatch Metrics**: Performance indicators and usage patterns
- **EventBridge Events**: Agent communication and workflow progress
- **DynamoDB Logs**: Detailed interaction history and state changes

## Best Practices

### Agent Specialization

- Keep agents focused on specific domains
- Avoid overlap in capabilities between agents
- Use composition for complex tasks requiring multiple domains

### Error Handling

- Implement graceful degradation when specialists are unavailable
- Provide fallback mechanisms for critical operations
- Log all agent interactions for debugging and improvement

### Security

- All agent communications are encrypted and authenticated
- Sensitive data is stored in AWS Secrets Manager
- Access controls are enforced at the IAM level

## Contributing

To add new agents or enhance existing ones:

1. Create agent definition in `.claude/agents/`
2. Implement required tools and integrations
3. Add documentation and usage examples
4. Test with Critic agent for quality assurance
5. Submit PR with comprehensive test coverage

For detailed implementation guidance, see the [MCP Server Documentation](../mcp-server/setup.md).
