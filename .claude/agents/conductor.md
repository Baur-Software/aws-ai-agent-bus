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

The aws-ai-agent-bus project implements a tiered workspace architecture (small/medium/large) with 12 Terraform modules in `/infra/modules/` and composed workspaces in `/infra/workspaces/`. Analysis reveals cost-effective scaling patterns with specific security and optimization opportunities by workspace tier.

## Workspace Architecture Analysis

### Small Workspaces (~$3-10/month total)
**Cost-optimized, core components for development and basic production**
- **kv_store**: DynamoDB on-demand (~$1-2/month)
- **artifacts_bucket**: S3 standard storage (~$1-3/month)
- **timeline_store**: S3 for event logs (~$0.50-1/month)  
- **event_bus**: EventBridge custom bus (~$1-2/month)
- **secrets**: AWS Secrets Manager (~$2-4/month)

### Medium Workspaces (~$25-75/month total)
**Domain stacks composing small workspaces for production workloads**
- **mesh_agents**: ECS Fargate tasks (~$15-40/month)
- **workflow**: Step Functions orchestration (~$5-15/month)
- **observability**: CloudWatch dashboards and logs (~$5-20/month)

### Large Workspaces (~$100-500/month total)
**High-performance, optional components for enterprise scale**
- **vector_pg**: Aurora PostgreSQL + pgvector (~$50-300/month)
- Analytics and high-availability components (~$50-200/month)

### Integration Workspaces (Cost varies by usage)
- **stripe**: Payment processing webhooks (~$5-20/month)
- **supabase**: BaaS integration (~$10-50/month)
- **vercel**: Frontend deployment automation (~$5-30/month)

## Module Security Assessment by Workspace Tier

### Small Workspace Security (Foundational)
**Priority**: Cost over security for development
- ✅ **DynamoDB encryption**: Built-in at-rest encryption
- ⚠️ **S3 encryption**: AES256 sufficient for small workspaces
- ⚠️ **Secrets basic**: Manual rotation acceptable
- ⚠️ **EventBridge**: No encryption at rest needed

**Recommended**: Keep current security posture for cost efficiency

### Medium Workspace Security (Production Ready)
**Priority**: Balanced security-cost for production workloads
- ⚠️ **ECS tasks**: Need VPC isolation (+$10-15/month)
- ⚠️ **Step Functions**: Add execution logging (+$2-5/month)
- ⚠️ **CloudWatch**: Encrypt log groups (+$1-3/month)

**Recommended**: Selective security upgrades for critical paths

### Large Workspace Security (Enterprise Grade)
**Priority**: Security over cost for high-value workloads
- 🔴 **Aurora**: Requires customer-managed KMS (+$5-10/month)
- 🔴 **VPC isolation**: Essential for database access (+$20-50/month)
- 🔴 **Backup encryption**: Critical for compliance (+$10-30/month)

**Recommended**: Full security hardening mandatory

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

## Recommended Action Plan by Workspace Tier

### Small Workspace Strategy (read_only → dry_run)
**Goal**: Maintain $10/month budget while improving efficiency
1. **Cost Optimization First**: S3 lifecycle policies and DynamoDB billing optimization
2. **Minimal Security**: Keep current encryption, add basic monitoring
3. **Timeline**: 1 sprint, focus on immediate cost savings

### Medium Workspace Strategy (dry_run → execute)
**Goal**: Production-ready security within $75/month budget
1. **Selective Hardening**: VPC isolation for ECS, encrypted CloudWatch logs
2. **Right-sizing**: ECS task optimization and Step Function tuning  
3. **Enhanced Monitoring**: Add alerts for cost thresholds and security events
4. **Timeline**: 2 sprints, phased security and optimization

### Large Workspace Strategy (execute with approval)
**Goal**: Enterprise-grade security and performance optimization
1. **Full Security Hardening**: Customer-managed KMS, VPC isolation, backup encryption
2. **Cost Management**: Reserved instances, intelligent scaling, lifecycle policies
3. **Compliance**: Automated scanning, policy enforcement, audit trails
4. **Timeline**: 3 sprints, with Critic approval for each phase

### Integration Workspace Strategy (as-needed basis)
**Goal**: Optimize per integration based on usage patterns
1. **Stripe**: Focus on webhook security and PCI compliance readiness
2. **Supabase**: Database security and backup strategies
3. **Vercel**: Deployment optimization and monitoring
4. **Timeline**: Parallel implementation based on business priority

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

| Workspace Tier | Current Cost | Security Level | Optimization Target | Security Investment |
|----------------|--------------|----------------|---------------------|-------------------|  
| **Small** | $3-10/month | Basic | -$2-4/month | Minimal (+$1-2/month) |
| **Medium** | $25-75/month | Production | -$15-25/month | Selective (+$10-20/month) |
| **Large** | $100-500/month | Enterprise | -$50-150/month | Comprehensive (+$30-80/month) |
| **Integration** | Variable | Per-service | Per-integration | Compliance-driven |

**Net Impact by Tier**:
- **Small**: -$1-2/month (cost optimization priority)
- **Medium**: -$5-15/month (balanced approach)  
- **Large**: -$20-70/month (efficiency at scale)

**Overall Risk Level**: Low (tiered approach allows gradual scaling of both security and costs)

---
*Report generated by Mentor agent analyzing infra/modules/\* at 2025-08-19*
*Next review recommended in 90 days or upon major architectural changes*