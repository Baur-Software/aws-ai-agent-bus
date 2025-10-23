# Building a Visual Workflow Ecosystem on MCP

**TL;DR:**

- Pub/sub dashboard server and UI for real-time collaboration
- AWS Bedrock and Ollama AI support
- Rust-based MCP server for multi-tenant isolation
- 900+ MCP servers supported with 1,000+ workflow nodes
- Event-driven architecture with EventBridge
- 11 importable workflow examples included
- Open source, MCP-native alternative to Make/Zapier

## Why I Built This

I spend most of my time bouncing between whiteboard tools and automation platforms. One day I thought: why can't these be the same thing?

So I built an infinite canvas where you can design workflows visually. But here's the twist—**the workflow nodes aren't just diagrams. They're the actual, functional components themselves.**

## What This Means in Practice

**Infrastructure & DevOps:**
Connect AWS services directly on the canvas. Watch infrastructure build in real-time with live status updates
on each node. Configure AWS components from the node's detail panel. Export your design to Terraform using our
AI experts. Connect GitHub and visualize your CI/CD pipeline as an execution diagram.

**Business Intelligence:**
Drop bar chart nodes on the canvas and connect to QuickBooks for financial dashboards. Link your CRM to match
invoices with sales pipelines, tracking the complete customer journey from lead to repeat client. Connect
Google Drive to automate company data backups.

**Analytics & Content:**
Pull Google Analytics data into DynamoDB. Create historical charts with time-series visualization nodes. Use AI to generate blog content based on keyword analysis.

**Home Automation:**
Integrate with Home Assistant to build custom automation workflows. Design nodes and layouts that match your actual home's layout.

## AI-Powered Workflow Generation

Let's be honest—manually configuring every workflow step is tedious. That's why we built AI directly into the system. Just log into your apps and ask the AI to build workflows for you. It handles the details.

## Why Not Just Use Make or Zapier?

Fair question. Tools like Make, Zapier, and n8n have been around for years. So why build something new?

### The Closed Ecosystem Problem

**Make and Zapier lock you into their proprietary integrations.** Want to connect a new service? Hope they support it. Want to customize how an integration works? Too bad—you get what they give you.

Even n8n, which is open source, requires you to write custom nodes in their specific framework. You're still bound to their architecture, their deployment model, their way of doing things.

### The MCP Difference

**We're built on the Model Context Protocol—an open standard from Anthropic.** This changes everything.

#### 900+ Integrations, Zero Vendor Lock-in

There are already 900+ MCP servers available in the ecosystem. Anyone can build an MCP server for any service, and it immediately works with our platform. No waiting for us to add support. No proprietary APIs to learn.

Want to integrate with your internal tools? Build a simple MCP server:

```typescript
// That's it. Deploy anywhere.
import { MCPServer } from '@modelcontextprotocol/sdk';

const server = new MCPServer({
  name: 'my-company-tools',
  tools: [
    {
      name: 'query-database',
      handler: async (params) => {
        // Your code here
      }
    }
  ]
});
```

Drop it on GitHub, connect it to our platform, and suddenly you have workflow nodes for your internal systems. Make can't do this. Zapier can't do this.

#### Bring Your Own MCP Server

We support connecting to any MCP server:

- **GitHub repositories** - Point us at a public repo with an MCP server
- **Docker containers** - Package your MCP server however you want
- **Local processes** - Run MCP servers on your own infrastructure
- **Community servers** - Use any of the 900+ existing MCP servers

This means if a service you need isn't supported, you don't wait for us. You don't file a feature request and hope.
You just build an MCP server (or use one someone else built) and connect it.

#### Open Source Core

Our dashboard UI, MCP server implementation, and workflow engine are open source. You can:

- **Fork and customize** - Change how workflows execute
- **Self-host** - Run the entire stack in your AWS account
- **Audit the code** - See exactly how your data is handled
- **Contribute** - Add features and share them with the community

Try doing that with Make or Zapier.

### The AI-Native Advantage

**Make and Zapier weren't designed for the AI era.** They're workflow automation tools with AI bolted on.

We're built AI-first:

#### AI Understands MCP Tools

Because we use MCP, AI agents can directly invoke tools. Ask Claude Code:

```
"Pull my Google Analytics data from last month,
store it in DynamoDB, and create a trend chart"
```

Claude Code uses our MCP server to execute this workflow—no UI clicking, no manual configuration. The AI understands the MCP tools and orchestrates them automatically.

Try asking Zapier's AI to do this. It'll generate a workflow for you to click through. That's not the same thing.

#### Agents Work With Agents

Our conductor/critic/specialist agent system can reason about and modify workflows. An agent can:

- Analyze your workflow for bottlenecks
- Suggest optimizations
- Add error handling automatically
- Generate new workflows from descriptions

This isn't possible with traditional automation tools because they don't expose their workflows as data that AI can
reason about. MCP does.

### The Real-Time Difference

**Make and Zapier poll APIs.** Check for changes every 5-15 minutes (unless you pay extra).

**We're event-driven.** EventBridge processes events in milliseconds. Your workflows react instantly:

- GitHub push → Build starts in <1s
- Payment received → Invoice sent immediately
- Sensor triggers → Lights respond in real-time

The canvas updates live as workflows execute. You watch your infrastructure build, your data flow, your integrations connect—all in real-time. That's not possible with polling-based systems.

### The Multi-Tenant Architecture

**Make and Zapier are SaaS platforms.** Your workflows run on their infrastructure, mixed with everyone else's.

**We give you true isolation:**

- Your workflows run in your AWS account
- Your data stays in your DynamoDB/S3
- Your events flow through your EventBridge
- Your secrets stored in your Secrets Manager

Multi-tenant at the MCP server level, but your actual data and execution? That's yours. This matters for compliance, data residency, and security.

### The Cost Model

**Make/Zapier charge per operation.** Scale up your workflows, watch costs explode.

**We charge for infrastructure.** Our tiered Terraform workspaces:

- **Small**: ~$10/month (DynamoDB, S3, EventBridge)
- **Medium**: ~$50-100/month (add ECS, Step Functions)
- **Large**: ~$200-500/month (Aurora, advanced analytics)

Run millions of workflow operations—costs scale with AWS usage, not per-execution fees.

### When to Use Make vs. Us

**Use Make/Zapier if:**

- You want zero infrastructure management
- You need workflows in 5 minutes with no setup
- You don't care about vendor lock-in
- Simple integrations between known SaaS tools

**Use our platform if:**

- You want control over your infrastructure and data
- You need AI-native workflow automation
- You want to integrate with custom/internal tools
- You value open source and extensibility
- You need real-time, event-driven workflows
- You want multi-tenant isolation with your own AWS resources

### The Vision

**Make and Zapier built workflow tools.**

**We're building an AI-powered workflow operating system on open standards.**

MCP is the protocol. EventBridge is the bus. Rust is the runtime. Open source is the philosophy.

Anyone can extend it. Everyone owns their data. AI agents orchestrate it all.

That's the difference.

## Architecture: A Git-Inspired Approach

### Multi-Tenant Context System

Our MCP server supports both personal and organizational contexts. Switch seamlessly between work and home projects. For enterprises, this means keeping data in your own organizational context with robust RBAC permissions on DynamoDB and S3.

### Version Control

The canvas autosaves continuously. The backend supports atomic rollbacks (UI support coming soon). You can fork (copy) workflows, plus full import/export support.

## Connected Apps

We support 900+ MCP servers today, providing over 1,000 custom workflow nodes. You can also bring your own MCP server—we support GitHub public repositories with more sources coming soon.

When you connect an app, our AI agents automatically install the corresponding workflow nodes, specialized agents, and shapes. Drop them on the canvas and start configuring. You can even customize the node configuration completely, adjusting details and defaults to your preferences.

## Dashboard Server

Built in TypeScript with a fully event-driven API over WebSocket. OAuth 2+ authentication. Secure credential storage for connected apps, delegating security to AWS where appropriate. All infrastructure defined as Terraform in the `infra/` directory.

## Why We Rewrote the MCP Server in Rust

Our journey to Rust wasn't driven by hype—it came from hitting real architectural walls with JavaScript.

### The JavaScript Reality Check

The original JavaScript MCP server worked great as an internal tool. npm packages for AWS, quick prototyping, familiar patterns. But then we started thinking bigger: **what if we hosted MCP connections for users?**

Suddenly we weren't building a single-user tool—we were architecting a multi-tenant system where one user's data absolutely could not leak into another's. That's where JavaScript's design started showing cracks.

### The Multi-Tenant Problem

**JavaScript's prototypical inheritance is powerful, but dangerous in multi-tenant scenarios.** Modify a prototype, and you've potentially affected every instance. In a multi-tenant system processing hundreds of concurrent requests from different organizations? That's a nightmare waiting to happen.

We found ourselves writing defensive code everywhere—deep cloning objects, wrapping every AWS SDK call in context guards, constant vigilance about closure scope. Even with all that, we couldn't shake the feeling that we were one subtle bug away from a catastrophic data leak.

### Enter Rust: Compile-Time Guarantees

Rust solved our architectural problems at compile time, not runtime.

#### 1. Memory Safety Without Runtime Cost

JavaScript's garbage collector is great for productivity, terrible for predictability. We'd see request latency spike during GC pauses. In a real-time workflow system where nodes update live on the canvas, those pauses were unacceptable.

Rust's ownership model eliminated the garbage collector entirely. Memory is freed deterministically when it goes out of scope. Our request latency became consistent—crucial for the live-update experience.

#### 2. Fearless Concurrency

This was the game-changer for multi-tenant isolation. In our Rust implementation, each tenant gets their own isolated context that the compiler enforces can't be shared unsafely across threads:

```rust
pub struct TenantContext {
    pub tenant_id: String,
    pub user_id: String,
    pub context_type: ContextType,
    pub permissions: Vec<Permission>,
    pub resource_limits: ResourceLimits,
}
```

If you try to pass mutable state without proper synchronization, it won't compile. This meant we could write concurrent code with confidence—four threads, handling hundreds of concurrent tenant requests, with compile-time guarantees that tenant data stays isolated.

#### 3. AWS Rate Limiting at the Type Level

We could model AWS service quotas directly in the type system:

```rust
pub struct AwsServiceLimits {
    pub dynamodb_read_units: u32,
    pub dynamodb_write_units: u32,
    pub s3_get_requests_per_sec: u32,
    // ... actual AWS quotas modeled as types
}
```

Our rate limiter uses token buckets per tenant, per service. We went from "probably staying under limits" to "mathematically guaranteed to stay under limits."

#### 4. Testing Confidence

Rust testing gives something JavaScript never could: **confidence**. The compiler caught hundreds of bugs that would have been runtime errors in JavaScript. Type mismatches, unhandled error cases, potential null pointer dereferences—all caught at compile time.

### The Performance Wins

- **Startup time**: JavaScript ~800ms → Rust **~50ms**
- **Request latency**: JavaScript 15-30ms → Rust **2-5ms**
- **Memory footprint**: JavaScript ~150MB → Rust **~8MB**
- **Concurrent capacity**: JavaScript ~100 requests → Rust **1000+**

For a system where nodes need real-time updates, those milliseconds matter. The canvas feels alive.

### The Tradeoffs

Rust isn't free. Development is slower. The learning curve is steep. But we're building infrastructure people trust with their business data. Fast iteration matters less than correctness. And once the code compiles, it tends to just work.

We went from "constantly worried about production bugs" to "confident in our multi-tenant isolation." That peace of mind is worth every extra hour spent learning Rust.

## MCP Capabilities: The Event-Driven Backbone

The MCP server isn't just a protocol adapter—it's the nervous system connecting AI agents to production infrastructure.

### The Core MCP Tools

Our Rust MCP server exposes 15 core tools:

**Persistent Memory**: `kv_get` / `kv_set` with sub-5ms response times

**Artifact Storage**: `artifacts_get` / `artifacts_put` / `artifacts_list` for S3-backed file storage

**Event System**: `events_send`, `events_query`, `events_analytics`, `events_create_rule`, `events_create_alert`, `events_health_check`

**Integration Management**: Dynamic MCP server discovery supporting 900+ servers

### Why Events Change Everything

**Everything is observable and composable.** Every action creates an event, enabling reactive workflows without tight coupling.

#### Real-World Example: CI/CD Pipeline

```
GitHub webhook → events_send("GitHub.Push")
  ↓
EventBridge rule matches
  ↓
Triggers: Build → Test → Deploy
  ↓
Each step publishes:
  - "Build.Completed"
  - "Test.Passed"
  - "Deploy.Success"
  ↓
SNS → Slack notification
```

GitHub doesn't know about Slack. The build system doesn't know about SNS. They're decoupled via events.

#### Live Canvas Updates

Events flow from Rust MCP → EventBridge → Dashboard Server → WebSocket → UI. When a node executes, the user sees it happen in real-time on the canvas.

#### Complete Observability

Every event stored in DynamoDB enables:

- **Audit trails** - "Show me everything user X did"
- **Debugging** - "Why did this workflow fail?"
- **Analytics** - "How many deployments this week?"
- **Compliance** - SOC2/HIPAA audit history

### Performance at Scale

- **Publishing**: ~2-3ms per event
- **Querying**: ~5-10ms with proper indexes
- **Bulk analytics**: 100K events in ~200ms

Rust with tokio handles thousands of concurrent event streams effortlessly.

## What's Next

We're excited about the possibilities this opens up. Visual workflow design, AI-powered automation, and the entire MCP ecosystem—all in one place.

**Try the workflow examples**: We've included 11 importable workflows in `workflow-examples/`:

- Infrastructure automation with Terraform generation
- Financial dashboards with QuickBooks + CRM
- Google Analytics reporting with AI content generation
- Home Assistant smart home automation

The foundation is solid. Now we build.

---

**GitHub**: [your-repo-link]
**Documentation**: [docs-link]
**Discord**: [community-link]

Built with MCP. Powered by Rust. Open source forever.
