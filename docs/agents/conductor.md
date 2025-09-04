---
name: Conductor
role: "Goal-driven planner, delegator, and arbiter"
capabilities:
  - goal_intake
  - context_build
  - task_decomposition
  - agent_delegation
  - lane_enforcement
  - progress_tracking
  - retrospective
tools: [git, shell, http, terraform, aws, k8s, files]
models:
  planner_primary: "${AGENT_MODEL_PRIMARY:-claude:latest}"
  planner_secondary: "${AGENT_MODEL_SECONDARY:-ollama:llama3.1}"
  workflow_engine: "${AGENT_MODEL_WORKFLOW:-dify:flows}"
io:
  inputs:  [goal, constraints, repo_paths, env, stakeholders]
  outputs: [plan.md, subtask_queue.json, status.md, timeline/*.ndjson]
handoff:
  to: Critic
  criteria: "Any step that modifies infra, data, prod content, or opens/merges PRs"
guardrails:
  lanes: [read_only, dry_run, execute]
  default_lane: read_only
  require_artifacts_for_promotion:
    - "terraform: plan.txt"
    - "k8s: diff.txt"
    - "code: test_report.json"
memory:
  kv: "memory/kv.sqlite"
  vector: "memory/vector.faiss"
  timeline: "memory/timeline.ndjson"
policy:
  approval_required_for_execute: true
  blast_radius_keywords: ["prod","payment","auth","iam","route53","cloudfront"]
  cost_delta_monthly_limit: 500
---

# You are the Conductor

Convert vague goals into explicit plans; delegate to orchestrators/specialists; enforce lanes and guardrails; coordinate Critic reviews; maintain progress and auditability.

## Operating Loop

**0) Context**
- Load facts from KV (accounts, budgets, endpoints, owners).
- Retrieve relevant docs via vector store (runbooks, READMEs, recent timeline).
- Start `plan.md` with: assumptions, constraints, exit criteria, and a short "won't do" list.

**1) Plan**
Produce a numbered plan with phases:
- Phase 1 (read_only): discovery, baselines, risk inventory.
- Phase 2 (dry_run): diffs/plans, tests, canaries.
- Phase 3 (execute): gated applies/merges with rollback and monitoring.

**2) Delegate**
Create `subtask_queue.json` entries with: id, agent, lane, inputs, deliverables, token budget.

**3) Collect & Gate**
- Validate that each subtask attaches artifacts (plans, diffs, test reports).
- Assemble a compact dossier for **Critic**: change summary, artifacts, blast radius, cost_delta_monthly, rollback.

**4) Execute (if approved)**
- Promote only the approved subtask(s) to `execute`.
- Prefer PRs to direct commits; store links in artifacts.
- Append a `timeline` event with refs.

**5) Retrospective**
- After execution, call **Sweeper** to write a brief retrospective, update runbooks, and refresh memory indexes.

## Lane Rules
- **read_only**: discovery; `terraform plan`, `kubectl diff`, analyzers, code searches.
- **dry_run**: staging or ephemeral envs; no prod mutation.
- **execute**: requires Critic ✅; use PRs/canaries with rollback steps.

## Promotion Checklist (attach to Critic)
- Summary & why
- Affected systems/repos/modules
- Artifacts: plans, diffs, test reports, screenshots/logs
- Blast radius & rollback procedure
- Estimated `cost_delta_monthly`
- Owner + fallback
- Rollout plan with thresholds

## Compact Commands
- "Conductor: create plan for <GOAL>, gather context, propose phases."
- "Conductor: delegate 'S3 lifecycle optimization' to terraform-architect in read_only."
- "Conductor: assemble dossier and request Critic review for execute."
- "Conductor: promote approved steps and record to timeline."

---

# TERRAFORM INFRASTRUCTURE ANALYSIS REPORT

## Executive Summary

The aws-ai-agent-bus project implements a clean two-layer architecture:
1. **MCP Server Infrastructure** (`mcp-server/terraform/`): Core services for agent coordination (~$5-15/month)
2. **Agent Infrastructure** (`infra/`): Tiered workspaces (small/medium/large) for specialized Claude agents

This separation ensures clean component boundaries where MCP provides standardized interfaces while agents build composite solutions from modular infrastructure.

## Architecture Analysis

### MCP Server Infrastructure (`mcp-server/terraform/`) - Core Layer (~$5-15/month)
**Foundational services providing standardized interfaces for all agents**
- **dynamodb_kv**: Key-value storage for agent state and coordination (~$1-3/month)
- **s3_bucket_artifacts**: Object storage for files and artifacts (~$1-3/month)
- **eventbridge_bus**: Event-driven communication between agents (~$1-2/month)
- **sqs_subtasks**: Message queuing for asynchronous processing (~$1-2/month)
- **secrets_min**: Secure credential storage (~$1-5/month)

**Design Principle**: These modules provide the MCP server backend - they should NOT be modified by agents, only used through standardized interfaces.

### Agent Infrastructure (`infra/`) - Specialized Layer

#### Small Agent Workspaces (~$30-50/month total)
**Basic agent execution capabilities for development and simple automation**
- Deploys alongside MCP server core
- Uses existing `/infra/workspaces/small/` structure
- Minimal agent compute resources
- Perfect for personal assistants and development

#### Medium Agent Workspaces (~$100-300/month total)
**Production agent orchestration with full workflow capabilities**
- **agent_orchestration**: Step Functions for conductor/critic/sweeper coordination (~$20-50/month)
- **agent_compute**: ECS Fargate tasks for containerized agents (~$30-100/month)
- **observability**: CloudWatch monitoring for agent performance (~$20-50/month)
- **workflow**: Complex multi-step agent processes (~$30-100/month)

#### Large Agent Workspaces (~$500-1000+/month total)
**Enterprise-scale ML-enhanced agents with vector capabilities**
- **agent_ml_features**: Aurora pgvector for semantic search (~$200-500/month)
- **vector_pg**: High-performance vector database (~$100-300/month)
- All medium workspace features included (~$100-300/month)
- Advanced analytics and reporting (~$100-200/month)

#### Integration Workspaces (Add-on costs)
**Third-party service integrations that agents can leverage**
- **stripe_integration**: Payment processing workflows (~$10-30/month)
- **supabase_integration**: Database and auth integration (~$15-40/month)  
- **vercel_integration**: Deployment pipeline automation (~$10-25/month)

## Security Assessment by Architecture Layer

### MCP Server Infrastructure Security (Always Production-Ready)
**Priority**: High security for core coordination services
- ✅ **DynamoDB**: Encryption at rest with service-managed keys
- ✅ **S3 Artifacts**: Server-side encryption with versioning
- ✅ **EventBridge**: Event payload encryption in transit
- ✅ **SQS**: Message encryption with automatic key rotation
- ✅ **Secrets Manager**: Automatic rotation and fine-grained access

**Design Principle**: MCP server must be secure by default since all agents depend on it.

### Agent Infrastructure Security (Tiered by Workspace)

#### Small Agent Workspace Security 
**Priority**: Development-friendly with basic production safeguards
- ✅ **Basic ECS**: Task-level IAM with least privilege
- ⚠️ **Networking**: Public subnets acceptable for development
- ⚠️ **Logging**: Standard CloudWatch logs sufficient
- ⚠️ **Monitoring**: Basic health checks

**Recommended**: Suitable for development and low-risk production workloads

#### Medium Agent Workspace Security
**Priority**: Production-ready with selective hardening
- ⚠️ **ECS Isolation**: VPC private subnets recommended (+$15-25/month)
- ⚠️ **Step Functions**: Execution role logging and monitoring (+$5-10/month)
- ⚠️ **Agent Communication**: Encrypted channels between agents (+$2-5/month)
- ⚠️ **Observability**: Encrypted log groups and metrics (+$3-8/month)

**Recommended**: Incremental security improvements for business-critical workflows

#### Large Agent Workspace Security
**Priority**: Enterprise-grade security mandatory
- 🔴 **Aurora pgvector**: Customer-managed KMS encryption (+$10-20/month)
- 🔴 **VPC Isolation**: Complete network segmentation (+$30-60/month)
- 🔴 **Backup Security**: Encrypted backups with compliance retention (+$15-40/month)
- 🔴 **Access Controls**: RBAC with detailed audit logging (+$10-25/month)

**Recommended**: Full security compliance required for enterprise deployments

## Critical Security Findings

### High Priority
- **S3 Encryption**: Switch from AES256 to customer-managed KMS keys
- **SQS Encryption**: Enable encryption at rest for message queues
- **Secrets Rotation**: No automatic rotation configured for any secrets
- **VPC Isolation**: Lambda functions exposed to public internet

### Medium Priority
- **IAM Policies**: Some overly broad `"*"` resource permissions
- **Webhook Validation**: Missing signature validation in Terraform configs
- **Public Access**: S3 buckets properly blocked but missing MFA delete

## Cost Optimization by Workspace Tier

### Small Workspace Optimizations (~$2-4/month savings)
**Focus**: Maximize cost efficiency without sacrificing core functionality
- **S3 Lifecycle**: Intelligent tiering for artifacts (-$0.50-1/month)
- **DynamoDB**: Use provisioned billing for predictable workloads (-$0.50-1/month)  
- **EventBridge**: Consolidate rules to reduce complexity (-$0.50/month)
- **Secrets**: Share non-sensitive secrets across environments (-$1-2/month)

### Medium Workspace Optimizations (~$15-25/month savings)
**Focus**: Right-size production resources for actual usage
- **ECS Tasks**: Scheduled scaling and spot instances (-$8-15/month)
- **Step Functions**: Optimize state transitions and reduce executions (-$2-5/month)
- **CloudWatch**: Log retention policies and metric filters (-$3-8/month)
- **Lambda**: Remove provisioned concurrency for integrations (-$2-5/month)

### Large Workspace Optimizations (~$50-150/month savings)
**Focus**: Enterprise-grade efficiency while maintaining performance
- **Aurora**: Reserved instances and intelligent scaling (-$30-80/month)
- **VPC**: Optimize NAT gateway usage and data transfer (-$10-30/month)
- **Backup**: Lifecycle policies for automated snapshots (-$5-20/month)
- **Cross-region**: Selective replication for critical data only (-$5-20/month)

## Architecture Strengths

### Design Patterns
- **Consistent Naming**: `agent-mesh-${var.env}` pattern across modules
- **Environment Awareness**: Different policies for dev/stage/prod
- **Lane-based Security**: Read-only, dry-run, execute permissions model
- **Event-driven**: EventBridge integration for loose coupling

### Operational Excellence
- **Observability**: CloudWatch logs and dashboards configured
- **Error Handling**: Dead letter queues and retry mechanisms
- **Approval Gates**: Step Functions with human approval steps
- **Artifact Storage**: Proper versioning and retention policies

## Recommended Action Plan by Architecture Layer

### MCP Server Infrastructure Strategy (read_only → dry_run)
**Goal**: Secure foundational services that all agents depend on
1. **Security First**: MCP server must be production-ready from day one
2. **Cost Optimization**: Focus on pay-per-use scaling and resource efficiency  
3. **Monitoring**: Essential health checks and performance metrics
4. **Timeline**: 1 sprint, prioritize security and reliability

**Deployment Priority**: Deploy MCP server infrastructure BEFORE any agent workspaces

### Small Agent Workspace Strategy (read_only → dry_run) 
**Goal**: Cost-effective development and simple production workloads (~$35-50/month)
1. **MCP Integration**: Ensure proper connection to MCP server infrastructure
2. **Basic Monitoring**: Essential agent health and performance tracking
3. **Cost Control**: Right-size resources for actual usage patterns
4. **Timeline**: 1 sprint after MCP server deployment

### Medium Agent Workspace Strategy (dry_run → execute)
**Goal**: Production-ready agent orchestration (~$150-300/month)
1. **Agent Orchestration**: Deploy Step Functions for conductor/critic/sweeper workflow
2. **Container Security**: ECS task security with proper IAM roles and networking
3. **Observability**: Comprehensive monitoring and alerting for agent performance
4. **Integration**: Connect with MCP server for state management and coordination
5. **Timeline**: 2 sprints, phased deployment with security validation

### Large Agent Workspace Strategy (execute with Critic approval)
**Goal**: Enterprise-grade ML-enhanced agents (~$500-1000+/month)
1. **ML Infrastructure**: Aurora pgvector for semantic search and embeddings
2. **Security Hardening**: Full enterprise compliance with encryption and network isolation
3. **Performance Optimization**: Vector database tuning and caching strategies
4. **Advanced Analytics**: AI agent performance insights and optimization
5. **Timeline**: 3 sprints, requires Critic approval for each major component

### Integration Strategy (as-needed basis)
**Goal**: Secure third-party service connections for specialized agents
1. **Stripe Integration**: Payment processing workflows with webhook security
2. **Supabase Integration**: Database and authentication for web-facing agents  
3. **Vercel Integration**: Deployment automation for agent-built applications
4. **Timeline**: Deploy alongside relevant agent workspaces

## Integration Impact Assessment

### Current Integrations
- **Payment Processing**: Stripe webhooks handle subscription management
- **Authentication**: Supabase provides user auth and database
- **Deployment**: Vercel handles frontend with custom domains
- **Orchestration**: Step Functions coordinate multi-agent workflows

### Dependencies
- **EventBridge**: Central nervous system for all integrations
- **S3**: Artifact storage critical for deployment pipeline
- **DynamoDB**: Session state and configuration storage
- **Secrets Manager**: API keys for all third-party integrations

## Compliance & Governance

### Current State
- **Environment Separation**: Clear dev/stage/prod boundaries
- **Access Controls**: Role-based permissions with lane enforcement
- **Audit Trail**: CloudWatch logging for all operations
- **Change Management**: Terraform state management with remote backend

### Gaps
- **Policy as Code**: Missing Sentinel/OPA policy enforcement
- **Automated Scanning**: No Terraform security scanning in CI/CD
- **Compliance Reporting**: No automated compliance checking
- **Disaster Recovery**: Limited backup strategies defined

## Workspace-Specific Next Steps for Conductor

### Immediate Actions (This Sprint)
1. **Small Workspaces**: Delegate S3 lifecycle and DynamoDB optimization to terraform-infrastructure-expert (read_only lane)
2. **Cost Baseline**: Establish current spend by workspace tier for optimization tracking
3. **Security Assessment**: Review workspace security posture against tier requirements

### Short-term (Next 2 Sprints)  
1. **Medium Workspaces**: Plan VPC isolation and ECS optimization (dry_run lane)
2. **Integration Security**: Assess webhook security across Stripe/Supabase/Vercel
3. **Monitoring**: Implement cost alerts and security monitoring by tier

### Long-term (3+ Sprints)
1. **Large Workspaces**: Design enterprise-grade security and compliance (execute lane with Critic approval)
2. **Multi-tier Strategy**: Develop promotion criteria between workspace tiers
3. **Disaster Recovery**: Plan backup and recovery strategies scaled by workspace tier

## Cost-Security Trade-off Matrix

| Architecture Layer | Current Cost | Security Level | Optimization Target | Security Investment |
|-------------------|--------------|----------------|---------------------|-------------------|
| **MCP Server** | $5-15/month | Production (Required) | -$2-5/month | Built-in security |
| **Small Agents** | $30-50/month | Development | -$5-10/month | Basic (+$5-10/month) |
| **Medium Agents** | $100-300/month | Production | -$20-50/month | Selective (+$25-50/month) |
| **Large Agents** | $500-1000+/month | Enterprise | -$100-200/month | Comprehensive (+$80-150/month) |
| **Integrations** | Variable | Per-service | Per-integration | Compliance-driven |

**Net Impact by Layer**:
- **MCP Server**: Break-even (security is non-negotiable)
- **Small Agents**: -$0-5/month (development-focused)
- **Medium Agents**: -$0-25/month (balanced production approach)  
- **Large Agents**: -$20-50/month (enterprise efficiency gains)

**Overall Risk Level**: Very Low (MCP server provides secure foundation; agents can scale security as needed)

---

## Key Architectural Decisions

### Clean Component Separation Achieved ✅
1. **MCP Server Infrastructure** (`mcp-server/terraform/`): Core coordination services that agents consume through standardized interfaces
2. **Agent Infrastructure** (`infra/`): Modular, composable infrastructure that specialized Claude agents can orchestrate and deploy

### Design Principles Enforced ✅
- **MCP Server**: Immutable foundation - agents interact through APIs, never modify directly
- **Agent Workspaces**: Composable modules that agents can deploy, modify, and optimize
- **Clear Boundaries**: No infrastructure overlap between MCP server and agent layers
- **Scalable Security**: Security scales with workspace tier while MCP remains production-ready

### Next Actions for Conductor ✅
1. **Phase 1 (read_only)**: Deploy MCP server infrastructure as secure foundation
2. **Phase 2 (dry_run)**: Plan agent workspace deployment based on requirements (small/medium/large)
3. **Phase 3 (execute)**: Delegate specialized infrastructure tasks to appropriate expert agents through MCP coordination

*Report updated reflecting clean architecture separation at 2025-08-20*  
*Next review recommended after MCP server deployment and first agent workspace implementation*