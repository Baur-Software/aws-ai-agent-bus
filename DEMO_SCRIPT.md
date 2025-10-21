# 🚀 AWS AI Agent Bus - Demo Script

## Overview
**AI-Powered Workflow Automation Platform** with Claude 3.7 Sonnet integration, MCP server architecture, and intelligent workflow generation.

**Demo Duration:** 15-20 minutes
**Presenter Setup:** Have dashboard-server and dashboard-ui running before demo

---

## 🎯 Demo Flow

### **Part 1: Introduction (2 minutes)**

**Key Points:**
- AWS AI Agent Bus enables no-code workflow automation with AI assistance
- Powered by Claude 3.7 Sonnet via AWS Bedrock
- 44 pre-built workflow nodes across 9 categories
- MCP (Model Context Protocol) server architecture for extensibility
- Real-time data visualization and analytics

**Show:**
- Dashboard homepage with metrics
- Quick tour of navigation (Workflows, Agents, Integrations, Chat)

---

### **Part 2: AI Chat Interface (3 minutes)**

**Demo Flow:**

1. **Open EnhancedChat** (Chat tab in sidebar)

2. **Show Chat Mode (General Questions)**
   ```
   Prompt: "What integrations do I currently have connected?"

   Expected: Claude lists connected services (if any)
   ```

3. **Toggle to Workflow Mode** (Click "Workflow Mode" button)
   - Notice UI changes to purple theme
   - Placeholder changes to "Describe the workflow you want to build..."

---

### **Part 3: Simple Workflow Generation (5 minutes)**

**Scenario:** Daily Slack Notifications

**Demo Script:**

1. **Click Example Prompt Button:**
   ```
   "Build a workflow that sends me a Slack message every day at 9am"
   ```

   **OR type manually if Slack not connected:**
   ```
   "Create a workflow that sends an email notification daily at 9am"
   ```

2. **Click Generate Button**

3. **Claude Responds:**
   - ✅ If Slack connected: Shows complete workflow JSON
   - ❌ If Slack not connected: Guides user to /settings/integrations

4. **Show Generated Workflow:**
   ```
   ✅ Workflow Generated Successfully!

   Name: Daily Slack Reminder
   Nodes: 2 (trigger-schedule, slack-message)
   Connections: 1

   [Preview Workflow] [Save Workflow] [Copy]
   ```

5. **Click "Preview Workflow"** (placeholder - shows toast notification)

6. **Click "Copy"** to copy the JSON

**Key Talking Points:**
- Claude checks user's connected integrations via MCP
- Validates workflow structure before returning
- Provides helpful guidance if integrations missing
- Generates production-ready workflow JSON

---

### **Part 4: Data Visualization Workflows (7 minutes)**

**Scenario:** Analytics Dashboard with Charts

**Demo Script:**

1. **Clear Chat** (optional, for clean demo)

2. **Use Visualization Example Prompt:**
   ```
   "Build a workflow that creates a time-series chart of Google Analytics traffic trends"
   ```

3. **Claude Generates Workflow with:**
   - Daily trigger (cron schedule)
   - Google Analytics query node
   - Time-series chart node with multiple series
   - Proper node positioning and connections

4. **Show Generated Workflow Details:**
   ```json
   {
     "name": "Analytics Visualization",
     "nodes": [
       {
         "id": "trigger-1",
         "type": "trigger-schedule",
         "config": { "schedule": "0 0 * * *" }
       },
       {
         "id": "ga-1",
         "type": "ga-query",
         "config": {
           "metrics": ["sessions", "users", "pageviews"],
           "dateRange": "last7days"
         }
       },
       {
         "id": "chart-1",
         "type": "chart-timeseries",
         "config": {
           "title": "7-Day Traffic Trends",
           "series": [
             { "field": "sessions", "label": "Sessions", "color": "#2196F3" },
             { "field": "users", "label": "Users", "color": "#4CAF50" }
           ]
         }
       }
     ]
   }
   ```

5. **Try Another Visualization:**
   ```
   "Create a workflow to show top pages in a bar chart daily"
   ```

   **Claude generates:**
   - GA query with top pages (orderBy, limit)
   - Bar chart node (horizontal orientation)
   - Email notification with chart

6. **Try Pie Chart:**
   ```
   "Generate a workflow with a pie chart showing traffic source distribution"
   ```

**Key Talking Points:**
- 3 chart types: time-series, bar, pie
- Claude knows when to use each type
- Automatically configures chart properties (colors, titles, axes)
- Can combine multiple charts in one workflow
- Integrates with Google Analytics, DynamoDB, S3, etc.

---

### **Part 5: Complex Multi-Step Workflow (3 minutes)**

**Scenario:** Complete Analytics Pipeline

**Demo Script:**

1. **Ask for Complex Workflow:**
   ```
   "Build a complete analytics workflow that:
   - Pulls Google Analytics data daily
   - Stores it in DynamoDB
   - Creates a time-series chart
   - Sends an email with the chart
   - Publishes an event to EventBridge"
   ```

2. **Claude Generates Multi-Node Workflow:**
   - Shows 5+ connected nodes
   - Demonstrates data flow: Fetch → Store → Visualize → Notify → Event
   - Proper node positioning (increments by ~200px)

3. **Highlight Key Features:**
   - Complex logic handling
   - Multiple output destinations
   - Event-driven architecture
   - Production-ready configuration

**Alternative Complex Prompts:**
```
"Build a workflow that monitors website uptime, stores results in DynamoDB, creates an alert chart, and sends Slack notifications when downtime is detected"

"Create a workflow that aggregates sales data from multiple sources, generates bar and pie charts, and emails a daily report to the team"
```

---

### **Part 6: Schema-Driven Architecture (2 minutes)**

**Technical Deep Dive** (for technical audience)

**Show Code (Optional):**

1. **Schema-Based JSON Extraction:**
   ```typescript
   // handlers.ts - Generic JSON extraction
   const WORKFLOW_SCHEMA = {
     required: ['nodes', 'connections'],
     properties: {
       nodes: { type: 'array', items: {...} },
       connections: { type: 'array' }
     },
     validate: (workflow) => {
       // Custom validation: check connection references
     }
   };

   // Can pass custom schemas for ANY JSON generation
   workflow.generate({ prompt, schema: CUSTOM_SCHEMA })
   ```

2. **MCP Context Awareness:**
   ```typescript
   // ChatService queries MCP for user context
   const connections = await getUserConnections(userId);
   // Claude receives:
   // - Connected integrations
   // - Available task types (44 nodes)
   // - Workflow schema
   // - Generation examples
   ```

**Key Talking Points:**
- Not hardcoded to workflows - works for any JSON structure
- Client can pass custom schemas
- 4 extraction strategies (markdown, schema-aware, object, array)
- Recursive validation with detailed error messages

---

### **Part 7: Q&A Prompts (Use as needed)**

**Fallback Prompts if Demo Needs Variety:**

**Simple Prompts:**
```
"Build a workflow that sends me an email every Monday morning"

"Create a workflow that logs data to the console when triggered"

"Generate a workflow with a daily trigger and HTTP GET request"
```

**Intermediate Prompts:**
```
"Build a workflow that fetches data from an API, transforms it, and stores it in DynamoDB"

"Create a workflow that runs every hour, checks GitHub repo stats, and sends a Slack notification if stars increase"

"Generate a workflow that processes webhook data and creates a bar chart"
```

**Advanced Prompts:**
```
"Build a complete ETL pipeline that:
  1. Fetches data from Google Analytics
  2. Transforms and filters the data
  3. Stores it in DynamoDB and S3
  4. Creates multiple charts (time-series, bar, pie)
  5. Sends email report
  6. Publishes events to EventBridge for downstream processing"

"Create a workflow that monitors multiple APIs, aggregates responses, generates visualizations, and sends alerts based on thresholds"
```

**Visualization-Focused Prompts:**
```
"Show me a workflow that creates a dashboard with 3 charts showing different views of analytics data"

"Build a workflow that generates a weekly report with time-series trends, top content bar chart, and traffic sources pie chart"

"Create a workflow that visualizes sales data with multiple chart types and emails the results"
```

---

## 🎨 Visual Highlights to Show

### **Chat UI Features:**
- ✅ Workflow Mode toggle (purple theme)
- ✅ Example prompt buttons (one-click)
- ✅ Dynamic placeholder text
- ✅ Workflow/Chat mode indicators
- ✅ Token usage display
- ✅ Session tracking
- ✅ Copy/Preview/Save buttons

### **Generated Workflow Quality:**
- ✅ Complete JSON structure
- ✅ Proper node IDs and types
- ✅ Positioned nodes (x, y coordinates)
- ✅ Full configuration objects
- ✅ Validated connections
- ✅ Metadata (author, version, timestamp)

### **Error Handling:**
- ✅ Missing integrations → Helpful guidance
- ✅ Invalid requests → Clarifying questions
- ✅ Malformed workflows → Validation errors with details

---

## 📊 Key Metrics to Highlight

**System Capabilities:**
- **44 Task Types** across 9 categories
- **10+ Integrations** (GA, Slack, GitHub, Stripe, AWS, etc.)
- **3 Chart Types** (time-series, bar, pie)
- **Schema-Driven** validation and extraction
- **Context-Aware** generation (knows user's integrations)
- **Claude 3.7 Sonnet** (latest, most capable model)

**Architecture:**
- **MCP Server**: Rust-based, stdio transport
- **WebSocket API**: Real-time communication
- **AWS Bedrock**: Managed Claude hosting
- **Event-Driven**: EventBridge for all major operations
- **Modular**: TaskRegistry with 44 registered tasks

---

## 🎯 Demo Success Criteria

**Must Show:**
1. ✅ AI-powered workflow generation (at least 2 examples)
2. ✅ Data visualization workflows (show chart nodes)
3. ✅ Context-aware generation (integration checking)
4. ✅ Workflow Mode vs Chat Mode
5. ✅ One complex multi-step workflow

**Bonus Points:**
- Schema-driven architecture explanation
- MCP context awareness
- Error handling (missing integrations)
- Copy/paste workflow JSON
- Multiple chart types in one workflow

---

## 🚨 Troubleshooting

**If Claude Doesn't Generate Workflow:**
- Check Workflow Mode is enabled (purple theme)
- Try clicking example prompt buttons
- Ensure AWS Bedrock connection is active (green dot in header)
- Check browser console for WebSocket errors

**If Missing Integrations:**
- This is expected behavior - Claude will guide user
- Shows the context-awareness feature
- Navigate to /settings/integrations to connect services

**If JSON Looks Wrong:**
- This demonstrates validation - show the error message
- Claude will ask for clarification
- Shows the schema validation working

---

## 🎬 Closing Remarks

**Key Takeaways:**
1. **AI-First Design**: Claude understands user intent and generates production-ready workflows
2. **Extensible Architecture**: MCP server enables unlimited integrations
3. **Visual Analytics**: Built-in chart generation for data-driven insights
4. **Developer-Friendly**: Schema-driven, type-safe, well-documented
5. **Production-Ready**: AWS Bedrock, EventBridge, DynamoDB backing

**Next Steps:**
- Try the example prompts
- Connect your integrations
- Generate your first workflow
- Export to production

**Questions?**

---

## 📝 Quick Reference

### **Pre-Demo Checklist:**
- [ ] Start dashboard-server: `cd dashboard-server && bun run dev`
- [ ] Start dashboard-ui: `cd dashboard-ui && bun run dev`
- [ ] Verify AWS Bedrock connection (green dot)
- [ ] Open EnhancedChat panel
- [ ] Clear any old chat history
- [ ] Have this script open for reference

### **Demo URLs:**
- Dashboard UI: `http://localhost:5173`
- Dashboard Server: `http://localhost:3001`
- EnhancedChat: Click "Chat" in sidebar

### **Emergency Fallback:**
If live demo fails, show:
1. Generated workflow JSON (copy from this script)
2. Code walkthrough (schema-driven extraction)
3. Architecture diagram (talk through components)

Good luck! 🚀
