import { createHtmlResource } from '@mcp-ui/server';

/**
 * UI Components for Google Analytics Dashboard
 * Provides interactive visualizations and controls for analytics data
 */
export class AnalyticsDashboard {
  
  /**
   * Create interactive dashboard for users by country report
   * @param {Array} data - Country analytics data
   * @param {Object} metadata - Report metadata
   * @returns {Object} MCP UI resource
   */
  static createUsersByCountryDashboard(data, metadata) {
    const totalUsers = data.reduce((sum, item) => sum + parseInt(item.totalUsers.replace(/,/g, '')), 0);
    
    // Generate chart data for visualization
    const chartData = data.slice(0, 10).map(item => ({
      country: item.country,
      users: parseInt(item.totalUsers.replace(/,/g, '')),
      engagement: parseFloat(item.engagementRate.replace('%', ''))
    }));

    return createHtmlResource({
      uri: `ui://analytics/users-by-country/${metadata.propertyId}`,
      content: {
        type: 'directHtml',
        htmlString: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Users by Country Dashboard</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f8fafc;
                color: #1a202c;
              }
              .dashboard {
                max-width: 1200px;
                margin: 0 auto;
              }
              .dashboard-header {
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                margin-bottom: 24px;
              }
              .dashboard-header h1 {
                margin: 0 0 8px 0;
                color: #2d3748;
                font-size: 28px;
              }
              .dashboard-header .subtitle {
                color: #718096;
                font-size: 16px;
              }
              .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 20px;
                margin-bottom: 32px;
              }
              .metric-card {
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                text-align: center;
              }
              .metric-card h3 {
                margin: 0 0 12px 0;
                color: #4a5568;
                font-size: 14px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .metric-value {
                font-size: 36px;
                font-weight: 700;
                color: #2b6cb0;
                display: block;
              }
              .chart-container {
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                margin-bottom: 24px;
              }
              .chart-container h2 {
                margin: 0 0 20px 0;
                color: #2d3748;
                font-size: 20px;
              }
              .data-table {
                background: white;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                overflow: hidden;
              }
              .data-table table {
                width: 100%;
                border-collapse: collapse;
              }
              .data-table th {
                background: #f7fafc;
                padding: 16px;
                text-align: left;
                font-weight: 600;
                color: #2d3748;
                border-bottom: 1px solid #e2e8f0;
              }
              .data-table td {
                padding: 16px;
                border-bottom: 1px solid #e2e8f0;
                color: #4a5568;
              }
              .data-table tr:hover {
                background: #f7fafc;
              }
              .actions {
                margin: 24px 0;
                text-align: center;
              }
              .btn {
                background: #3182ce;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                margin: 0 8px;
                text-decoration: none;
                display: inline-block;
              }
              .btn:hover {
                background: #2c5aa0;
              }
              .btn-secondary {
                background: #718096;
              }
              .btn-secondary:hover {
                background: #4a5568;
              }
            </style>
          </head>
          <body>
            <div class="dashboard">
              <div class="dashboard-header">
                <h1>Users by Country Report</h1>
                <div class="subtitle">Last ${metadata.days} days • Updated ${new Date(metadata.retrievedAt).toLocaleString()}</div>
              </div>

              <div class="metrics-grid">
                <div class="metric-card">
                  <h3>Total Users</h3>
                  <span class="metric-value">${totalUsers.toLocaleString()}</span>
                </div>
                <div class="metric-card">
                  <h3>Countries</h3>
                  <span class="metric-value">${data.length}</span>
                </div>
                <div class="metric-card">
                  <h3>Top Country</h3>
                  <span class="metric-value">${data[0]?.countryCode || 'N/A'}</span>
                </div>
                <div class="metric-card">
                  <h3>Avg Engagement</h3>
                  <span class="metric-value">${(data.reduce((sum, item) => sum + parseFloat(item.engagementRate.replace('%', '')), 0) / data.length).toFixed(1)}%</span>
                </div>
              </div>

              <div class="chart-container">
                <h2>Top 10 Countries by Users</h2>
                <canvas id="usersChart" width="800" height="400"></canvas>
              </div>

              <div class="chat-container">
                <h2>💬 AI Assistant Chat</h2>
                <p>Ask questions about your analytics or request reports using natural language:</p>
                
                <div class="chat-input">
                  <input type="text" id="chatInput" placeholder="e.g., 'Show me users by country for the last 7 days' or 'Generate a content calendar'" onkeypress="handleChatKeypress(event)">
                  <button class="btn" onclick="sendChatMessage()">Send</button>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                  <div class="chat-message assistant">
                    <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                    <div>Hi! I can help you with analytics data and reports. Try asking me something like:</div>
                    <ul>
                      <li>"Show me top pages for the last 30 days"</li>
                      <li>"Generate a content calendar for next month"</li>
                      <li>"Export this data as CSV"</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div class="actions">
                <button class="btn" onclick="exportToPDF()">Export PDF</button>
                <button class="btn btn-secondary" onclick="refreshData()">Refresh Data</button>
                <button class="btn btn-secondary" onclick="downloadCSV()">Download CSV</button>
              </div>

              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Country</th>
                      <th>Code</th>
                      <th>Total Users</th>
                      <th>Active Users</th>
                      <th>Engagement Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.map((item, index) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td>${item.country}</td>
                        <td>${item.countryCode}</td>
                        <td>${item.totalUsers}</td>
                        <td>${item.activeUsers}</td>
                        <td>${item.engagementRate}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <script>
              // Chart configuration
              const ctx = document.getElementById('usersChart').getContext('2d');
              const chartData = ${JSON.stringify(chartData)};
              
              new Chart(ctx, {
                type: 'bar',
                data: {
                  labels: chartData.map(item => item.country),
                  datasets: [{
                    label: 'Users',
                    data: chartData.map(item => item.users),
                    backgroundColor: 'rgba(49, 130, 206, 0.8)',
                    borderColor: 'rgba(49, 130, 206, 1)',
                    borderWidth: 1
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return value.toLocaleString();
                        }
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }
              });

              // Chat functionality
              function sendChatMessage() {
                const input = document.getElementById('chatInput');
                const message = input.value.trim();
                if (!message) return;
                
                // Add user message to chat
                addChatMessage(message, 'user');
                input.value = '';
                
                // Process the message and make MCP tool call
                processChatMessage(message);
              }
              
              function handleChatKeypress(event) {
                if (event.key === 'Enter') {
                  sendChatMessage();
                }
              }
              
              function addChatMessage(message, sender) {
                const chatMessages = document.getElementById('chatMessages');
                const messageDiv = document.createElement('div');
                messageDiv.className = \`chat-message \${sender}\`;
                messageDiv.innerHTML = \`
                  <div class="timestamp">\${new Date().toLocaleTimeString()}</div>
                  <div>\${message}</div>
                \`;
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
              
              function processChatMessage(message) {
                const lowerMessage = message.toLowerCase();
                
                if (lowerMessage.includes('export') && lowerMessage.includes('pdf')) {
                  exportToPDF();
                  addChatMessage('Exporting data as PDF...', 'assistant');
                } else if (lowerMessage.includes('csv') || lowerMessage.includes('download')) {
                  downloadCSV();
                  addChatMessage('Downloading CSV file...', 'assistant');
                } else if (lowerMessage.includes('refresh') || lowerMessage.includes('update')) {
                  refreshData();
                  addChatMessage('Refreshing analytics data...', 'assistant');
                } else if (lowerMessage.includes('content calendar')) {
                  generateContentCalendar();
                  addChatMessage('Generating content calendar...', 'assistant');
                } else if (lowerMessage.includes('top pages')) {
                  const days = extractDays(message) || 30;
                  getTopPages(days);
                  addChatMessage(\`Getting top pages for the last \${days} days...\`, 'assistant');
                } else {
                  // Generic MCP tool call
                  callMCPTool('ga.analyzeContentOpportunities', {
                    query: message,
                    propertyId: '${metadata.propertyId}'
                  });
                  addChatMessage('Let me analyze that for you...', 'assistant');
                }
              }
              
              function extractDays(message) {
                const match = message.match(/(\\d+)\\s*days?/i);
                return match ? parseInt(match[1]) : null;
              }

              // Interactive functions
              function exportToPDF() {
                window.open(\`/api/analytics/users-by-country/pdf?propertyId=\${encodeURIComponent('${metadata.propertyId}')}&days=${metadata.days}\`, '_blank');
              }

              function downloadCSV() {
                window.open(\`/api/analytics/users-by-country/csv?propertyId=\${encodeURIComponent('${metadata.propertyId}')}&days=${metadata.days}\`, '_blank');
              }

              function refreshData() {
                location.reload();
              }
              
              function generateContentCalendar() {
                callMCPTool('ga.generateContentCalendar', {
                  propertyId: '${metadata.propertyId}',
                  siteUrl: 'https://example.com'
                });
              }
              
              function getTopPages(days = 30) {
                callMCPTool('ga.getTopPages', {
                  propertyId: '${metadata.propertyId}',
                  days: days
                });
              }
              
              function callMCPTool(toolName, args) {
                fetch('/mcp', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: {
                      name: toolName,
                      arguments: args
                    }
                  })
                })
                .then(response => response.json())
                .then(data => {
                  if (data.result) {
                    addChatMessage(\`✅ Success! \${JSON.stringify(data.result, null, 2)}\`, 'assistant');
                  } else {
                    addChatMessage(\`❌ Error: \${data.error?.message || 'Unknown error'}\`, 'assistant');
                  }
                })
                .catch(error => {
                  addChatMessage(\`❌ Network error: \${error.message}\`, 'assistant');
                });
              }
            </script>
          </body>
          </html>
        `
      },
      delivery: 'text'
    });
  }

  /**
   * Create interactive content calendar dashboard
   * @param {Object} calendar - Generated content calendar
   * @param {Object} metadata - Calendar metadata
   * @returns {Object} MCP UI resource
   */
  static createContentCalendarDashboard(calendar, metadata) {
    const itemsByType = calendar.items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});

    return createHtmlResource({
      uri: `ui://analytics/content-calendar/${calendar.month}-${calendar.year}`,
      content: {
        type: 'directHtml',
        htmlString: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Content Calendar - ${calendar.month}/${calendar.year}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f8fafc;
                color: #1a202c;
              }
              .calendar-container {
                max-width: 1200px;
                margin: 0 auto;
              }
              .calendar-header {
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                margin-bottom: 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .calendar-title {
                margin: 0;
                color: #2d3748;
                font-size: 28px;
              }
              .calendar-stats {
                display: flex;
                gap: 20px;
              }
              .stat {
                text-align: center;
              }
              .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: #3182ce;
              }
              .stat-label {
                font-size: 12px;
                color: #718096;
                text-transform: uppercase;
              }
              .content-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                gap: 20px;
              }
              .content-item {
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                border-left: 4px solid;
              }
              .content-item.pillar { border-left-color: #9f7aea; }
              .content-item.social { border-left-color: #38b2ac; }
              .content-item.blog { border-left-color: #ed8936; }
              .content-item h3 {
                margin: 0 0 12px 0;
                color: #2d3748;
                font-size: 18px;
              }
              .content-item p {
                margin: 0 0 16px 0;
                color: #4a5568;
                line-height: 1.5;
              }
              .content-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
              }
              .content-type {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
              }
              .type-pillar { background: #e9d5ff; color: #7c3aed; }
              .type-social { background: #b2f5ea; color: #0f766e; }
              .type-blog { background: #fed7aa; color: #c2410c; }
              .priority {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
              }
              .priority-high { background: #fee2e2; color: #dc2626; }
              .priority-medium { background: #fef3c7; color: #d97706; }
              .priority-low { background: #d1fae5; color: #059669; }
              .due-date {
                color: #718096;
                font-size: 14px;
              }
              .keywords {
                margin-top: 12px;
              }
              .keyword {
                display: inline-block;
                background: #e2e8f0;
                color: #4a5568;
                padding: 2px 6px;
                border-radius: 12px;
                font-size: 11px;
                margin: 2px;
              }
              .actions {
                margin: 24px 0;
                text-align: center;
              }
              .btn {
                background: #3182ce;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                margin: 0 8px;
                text-decoration: none;
                display: inline-block;
              }
              .btn:hover { background: #2c5aa0; }
              .btn-secondary {
                background: #718096;
              }
              .btn-secondary:hover { background: #4a5568; }
              .chat-container {
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                margin-bottom: 24px;
              }
              .chat-input {
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
              }
              .chat-input input {
                flex: 1;
                padding: 12px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                font-size: 14px;
              }
              .chat-input input:focus {
                outline: none;
                border-color: #3182ce;
              }
              .chat-messages {
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
                background: #f8fafc;
              }
              .chat-message {
                margin-bottom: 12px;
                padding: 8px 12px;
                border-radius: 6px;
                background: white;
              }
              .chat-message.user {
                background: #e3f2fd;
                margin-left: 20px;
              }
              .chat-message.assistant {
                background: #f3e5f5;
                margin-right: 20px;
              }
              .chat-message .timestamp {
                font-size: 11px;
                color: #718096;
                margin-bottom: 4px;
              }
            </style>
          </head>
          <body>
            <div class="calendar-container">
              <div class="calendar-header">
                <h1 class="calendar-title">Content Calendar - ${calendar.month}/${calendar.year}</h1>
                <div class="calendar-stats">
                  <div class="stat">
                    <div class="stat-value">${calendar.items.length}</div>
                    <div class="stat-label">Total Items</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">${itemsByType.pillar || 0}</div>
                    <div class="stat-label">Pillar</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">${itemsByType.social || 0}</div>
                    <div class="stat-label">Social</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">${itemsByType.blog || 0}</div>
                    <div class="stat-label">Blog</div>
                  </div>
                </div>
              </div>

              <div class="actions">
                <button class="btn" onclick="exportToTrello()">Export to Trello</button>
                <button class="btn btn-secondary" onclick="downloadCSV()">Download CSV</button>
                <button class="btn btn-secondary" onclick="regenerateCalendar()">Regenerate</button>
              </div>

              <div class="content-grid">
                ${calendar.items.map(item => `
                  <div class="content-item ${item.type}">
                    <div class="content-meta">
                      <span class="content-type type-${item.type}">${item.type}</span>
                      <span class="priority priority-${item.priority}">${item.priority}</span>
                    </div>
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    <div class="due-date">Due: ${new Date(item.dueDate).toLocaleDateString()}</div>
                    ${item.keywords ? `
                      <div class="keywords">
                        ${item.keywords.map(keyword => `<span class="keyword">${keyword}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>

            <script>
              function exportToTrello() {
                window.parent.postMessage({
                  type: 'mcp-tool-call',
                  tool: 'workflow.createTrelloBoard',
                  arguments: {
                    boardName: 'Content Calendar ${calendar.month}/${calendar.year}',
                    items: ${JSON.stringify(calendar.items)}
                  }
                }, '*');
              }

              function downloadCSV() {
                const csv = generateCSV(${JSON.stringify(calendar.items)});
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'content-calendar-${calendar.month}-${calendar.year}.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              }

              function regenerateCalendar() {
                window.parent.postMessage({
                  type: 'mcp-tool-call',
                  tool: 'ga.generateContentCalendar',
                  arguments: {
                    propertyId: '${metadata.propertyId || 'current'}',
                    siteUrl: '${metadata.siteUrl || 'current'}',
                    targetMonth: '${calendar.year}-${calendar.month.toString().padStart(2, '0')}'
                  }
                }, '*');
              }

              function generateCSV(items) {
                const headers = ['Type', 'Title', 'Description', 'Due Date', 'Priority', 'Keywords'];
                const rows = items.map(item => [
                  item.type,
                  item.title,
                  item.description,
                  new Date(item.dueDate).toLocaleDateString(),
                  item.priority,
                  (item.keywords || []).join('; ')
                ]);
                return [headers, ...rows].map(row => 
                  row.map(cell => '"' + (cell || '').replace(/"/g, '""') + '"').join(',')
                ).join('\\n');
              }
            </script>
          </body>
          </html>
        `
      },
      delivery: 'text'
    });
  }
}

export default AnalyticsDashboard;