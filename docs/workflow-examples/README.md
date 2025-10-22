# Workflow Examples

Importable workflow examples demonstrating the AWS AI Agent Bus platform capabilities.

## Overview

These examples showcase real-world workflows you can import and customize. Each workflow is a complete, working example that integrates with the MCP server and demonstrates specific use cases mentioned in our vision:

> *"I spend a lot of time in whiteboard tools and automation tools. I thought: why can't I have them both in one place? That's what I did. I created an infinite canvas where you can design workflows. The workflow nodes on the canvas are the thing itself."*

## Quick Import

### Via Dashboard UI

1. Navigate to **Workflows → Import**
2. Select a JSON file from this directory
3. Click **Import** to add to your canvas

### Via WorkflowStorageService

```typescript
import { WorkflowStorageService } from '../dashboard-ui/src/services/WorkflowStorageService';

const workflowJson = fs.readFileSync('workflow-examples/infrastructure/aws-infrastructure-manager.json', 'utf-8');
const result = await workflowStorage.importWorkflows(workflowJson);
console.log(`Imported ${result.imported} workflows`);
```

## Categories

### 🏗️ Infrastructure & DevOps (`infrastructure/`)

**Connect AWS infrastructure together. Let the system build what you need with real-time updates on the node itself.**

- **[aws-infrastructure-manager.json](infrastructure/aws-infrastructure-manager.json)** - Visual AWS service orchestration with live status updates
- **[cicd-pipeline-visualizer.json](infrastructure/cicd-pipeline-visualizer.json)** - GitHub integration showing pipeline execution in real-time
- **[terraform-generator.json](infrastructure/terraform-generator.json)** - Design infrastructure visually, export to Terraform with AI experts

### 💼 Business Intelligence (`business/`)

**Add bar chart nodes and connect to QuickBooks to make a financial dashboard. Match invoices with sales pipelines.**

- **[financial-dashboard.json](business/financial-dashboard.json)** - QuickBooks + CRM integration for complete customer journey
- **[sales-pipeline-tracker.json](business/sales-pipeline-tracker.json)** - Match invoices with sales data, track leads to repeat clients
- **[company-data-backup.json](business/company-data-backup.json)** - Automated Google Drive backups of company data

### 📊 Analytics & Content (`analytics/`)

**Pull Google Analytics data and store it in DynamoDB. Create historical data charts. Use AI to write content.**

- **[google-analytics-reporter.json](analytics/google-analytics-reporter.json)** - GA data → DynamoDB with time-series visualization
- **[content-generator.json](analytics/content-generator.json)** - AI-powered blog content from keyword analysis
- **[historical-analytics.json](analytics/historical-analytics.json)** - Long-term data storage and trend analysis

### 🏠 Home Automation (`home-automation/`)

**Connect to Home Assistant to quickly build workflows and customize your home integrations.**

- **[home-assistant-integration.json](home-automation/home-assistant-integration.json)** - Custom automation workflows for smart home
- **[home-layout-designer.json](home-automation/home-layout-designer.json)** - Visual representation of your actual home layout

## Example Structure

Each workflow JSON file contains:

```typescript
{
  "version": "1.0",
  "name": "Workflow Name",
  "description": "What this workflow does",
  "nodes": [
    // Workflow nodes with configuration
  ],
  "connections": [
    // How nodes connect together
  ],
  "metadata": {
    "author": "AWS AI Agent Bus",
    "tags": ["category", "keywords"],
    "category": "Infrastructure",
    "requiredApps": ["github", "aws"],
    "estimatedDuration": "5 minutes",
    "difficulty": "intermediate",
    "isTemplate": true
  }
}
```

## Required Integrations

Before using these workflows, connect the required apps:

### Infrastructure Workflows

- AWS (native integration)
- GitHub (OAuth2)
- Terraform (via MCP server)

### Business Workflows

- QuickBooks (OAuth2)
- Salesforce/CRM (OAuth2)
- Google Drive (OAuth2)

### Analytics Workflows

- Google Analytics (OAuth2 - see [setup guide](../docs/mcp-server/google-analytics-setup.md))
- OpenAI/Bedrock (API key)

### Home Automation Workflows

- Home Assistant (API token)

## Customization Guide

### 1. Import the Workflow

Start with a template that matches your use case

### 2. Configure Nodes

Click on each node to configure:

- API endpoints
- Credentials
- Data transformations
- Conditional logic

### 3. Test & Iterate

- Use the built-in debugger
- View real-time execution
- Adjust based on results

### 4. Save & Schedule

- Save your customized workflow
- Set up triggers (schedule, webhook, event)
- Monitor execution history

## AI-Powered Workflow Generation

Don't want to build manually? **Just ask the AI to build workflows for you:**

```
"Build me a workflow that pulls Google Analytics data daily,
stores it in DynamoDB, and sends a Slack notification when
traffic spikes above 10,000 visitors."
```

The AI will:

1. ✅ Check which apps you've connected
2. ✅ Install required workflow nodes
3. ✅ Design the complete workflow
4. ✅ Configure all connections
5. ✅ Set up triggers and notifications

## Versioning & Forking

### Version Control

- Canvas autosaves continuously
- Backend supports atomic rollbacks
- Full version history (UI support coming soon)

### Fork Workflows

- Make a copy: **Right-click → Duplicate**
- Customize without affecting original
- Share your improved version

### Import/Export

- Export: **Workflow → Export → JSON**
- Import: **Workflows → Import → Select File**
- Share with team or community

## Example Use Cases from Our Vision

### Infrastructure Automation

> "Connect AWS infrastructure together. Configure AWS components right from the node's details panel. Take your design and output it to Terraform using our AI Terraform experts."

**Try:** `infrastructure/terraform-generator.json`

### Financial Dashboard

> "Add bar chart nodes and connect to QuickBooks to make a financial dashboard. Connect other apps like CRMs to match up invoices with sales pipelines."

**Try:** `business/financial-dashboard.json`

### Content Strategy

> "Pull down Google Analytics data and store it in DynamoDB. Use AI to write content to your blogs based on keyword analysis."

**Try:** `analytics/content-generator.json`

### Smart Home

> "Connect it to Home Assistant to quickly build out workflows and customize your home integrations. Create custom nodes to represent your home the way you want it."

**Try:** `home-automation/home-assistant-integration.json`

## Contributing Examples

Want to share your workflows?

1. **Create in the UI** - Build and test your workflow
2. **Export to JSON** - Use the export feature
3. **Add Metadata** - Include description, tags, required apps
4. **Submit PR** - Place in appropriate category directory
5. **Update README** - Add your workflow to this list

## Support

- **Documentation**: [docs/workflows/](../docs/workflows/)
- **MCP Server API**: [docs/mcp-server/api.md](../docs/mcp-server/api.md)
- **Setup Guides**: [docs/mcp-server/setup.md](../docs/mcp-server/setup.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/aws-ai-agent-bus/issues)

---

**Status**: 🚧 In Progress - Adding 11 importable examples
**Last Updated**: 2025-10-11
