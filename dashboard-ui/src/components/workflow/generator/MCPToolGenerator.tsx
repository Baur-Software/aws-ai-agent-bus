import { createSignal, createEffect, For, Show, createMemo } from 'solid-js';
import { useDashboardServer } from '../../../contexts/DashboardServerContext';
import { useIntegrations } from '../../../contexts/IntegrationsContext';
import { useOrganization } from '../../../contexts/OrganizationContext';

interface MCPToolTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  toolType: 'api' | 'data-transformation' | 'notification' | 'automation' | 'integration';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  requiredInputs: ToolInput[];
  outputSchema: any;
  codeTemplate: string;
  exampleUsage: string;
  supportedApps: string[];
}

interface ToolInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: string;
}

interface GeneratedTool {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
  implementation: string;
  testCases: TestCase[];
}

interface TestCase {
  name: string;
  input: Record<string, any>;
  expectedOutput: any;
  description: string;
}

export default function MCPToolGenerator() {
  const dashboardServer = useDashboardServer();
  const integrations = useIntegrations();
  const { currentOrganization } = useOrganization();

  const [selectedTemplate, setSelectedTemplate] = createSignal<MCPToolTemplate | null>(null);
  const [toolName, setToolName] = createSignal('');
  const [toolDescription, setToolDescription] = createSignal('');
  const [customInputs, setCustomInputs] = createSignal<ToolInput[]>([]);
  const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
  const [selectedComplexity, setSelectedComplexity] = createSignal<string>('all');
  const [loading, setLoading] = createSignal(false);
  const [generatedTool, setGeneratedTool] = createSignal<GeneratedTool | null>(null);
  const [showPreview, setShowPreview] = createSignal(false);

  // MCP Tool Templates
  const toolTemplates: MCPToolTemplate[] = [
    {
      id: 'api-fetcher',
      name: 'API Data Fetcher',
      description: 'Fetch data from external APIs with authentication and error handling',
      category: 'Integration',
      toolType: 'api',
      complexity: 'beginner',
      requiredInputs: [
        { name: 'url', type: 'string', required: true, description: 'API endpoint URL' },
        { name: 'method', type: 'string', required: false, description: 'HTTP method (GET, POST, etc.)', defaultValue: 'GET' },
        { name: 'headers', type: 'object', required: false, description: 'Request headers' },
        { name: 'params', type: 'object', required: false, description: 'Query parameters' }
      ],
      outputSchema: {
        type: 'object',
        properties: {
          data: { type: 'any', description: 'Response data' },
          status: { type: 'number', description: 'HTTP status code' },
          success: { type: 'boolean', description: 'Request success status' }
        }
      },
      codeTemplate: `
export async function ${'{toolName}'}({ url, method = 'GET', headers = {}, params = {} }) {
  try {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (method === 'GET' && Object.keys(params).length > 0) {
      const urlObj = new URL(url);
      Object.keys(params).forEach(key => {
        urlObj.searchParams.append(key, params[key]);
      });
      url = urlObj.toString();
    }

    const response = await fetch(url, config);
    const data = await response.json();

    return {
      data,
      status: response.status,
      success: response.ok
    };
  } catch (error) {
    return {
      data: null,
      status: 0,
      success: false,
      error: error.message
    };
  }
}`,
      exampleUsage: `
// Fetch user data from an API
const result = await ${'{toolName}'}({
  url: 'https://api.example.com/users/123',
  headers: { 'Authorization': 'Bearer token123' }
});

if (result.success) {
  console.log('User data:', result.data);
}`,
      supportedApps: ['any']
    },
    {
      id: 'data-transformer',
      name: 'Data Transformer',
      description: 'Transform and format data between different structures',
      category: 'Data Processing',
      toolType: 'data-transformation',
      complexity: 'intermediate',
      requiredInputs: [
        { name: 'inputData', type: 'object', required: true, description: 'Data to transform' },
        { name: 'transformRules', type: 'object', required: true, description: 'Transformation rules mapping' },
        { name: 'outputFormat', type: 'string', required: false, description: 'Output format', defaultValue: 'object' }
      ],
      outputSchema: {
        type: 'object',
        properties: {
          transformedData: { type: 'any', description: 'Transformed data' },
          originalCount: { type: 'number', description: 'Original data count' },
          transformedCount: { type: 'number', description: 'Transformed data count' }
        }
      },
      codeTemplate: `
export function ${'{toolName}'}({ inputData, transformRules, outputFormat = 'object' }) {
  try {
    const transform = (data, rules) => {
      if (Array.isArray(data)) {
        return data.map(item => transform(item, rules));
      }

      if (typeof data === 'object' && data !== null) {
        const result = {};

        Object.keys(rules).forEach(targetKey => {
          const sourceKey = rules[targetKey];
          if (typeof sourceKey === 'string') {
            result[targetKey] = data[sourceKey];
          } else if (typeof sourceKey === 'function') {
            result[targetKey] = sourceKey(data);
          }
        });

        return result;
      }

      return data;
    };

    const transformedData = transform(inputData, transformRules);

    return {
      transformedData,
      originalCount: Array.isArray(inputData) ? inputData.length : 1,
      transformedCount: Array.isArray(transformedData) ? transformedData.length : 1
    };
  } catch (error) {
    throw new Error(\`Data transformation failed: \${error.message}\`);
  }
}`,
      exampleUsage: `
// Transform user data structure
const result = ${'{toolName}'}({
  inputData: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  transformRules: {
    name: (data) => \`\${data.firstName} \${data.lastName}\`,
    contact: 'email'
  }
});

console.log(result.transformedData); // { name: 'John Doe', contact: 'john@example.com' }`,
      supportedApps: ['any']
    },
    {
      id: 'slack-notifier',
      name: 'Slack Notification Tool',
      description: 'Send formatted notifications to Slack channels',
      category: 'Communication',
      toolType: 'notification',
      complexity: 'beginner',
      requiredInputs: [
        { name: 'channel', type: 'string', required: true, description: 'Slack channel name or ID' },
        { name: 'message', type: 'string', required: true, description: 'Message content' },
        { name: 'username', type: 'string', required: false, description: 'Bot username' },
        { name: 'emoji', type: 'string', required: false, description: 'Bot emoji icon' }
      ],
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', description: 'Notification success status' },
          messageId: { type: 'string', description: 'Slack message ID' },
          timestamp: { type: 'string', description: 'Message timestamp' }
        }
      },
      codeTemplate: `
export async function ${'{toolName}'}({ channel, message, username, emoji }) {
  try {
    // Get Slack credentials from integration
    const slackConfig = await getIntegrationConfig('slack');

    const payload = {
      channel: channel.startsWith('#') ? channel : \`#\${channel}\`,
      text: message,
      ...(username && { username }),
      ...(emoji && { icon_emoji: emoji })
    };

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${slackConfig.botToken}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.ok) {
      return {
        success: true,
        messageId: result.ts,
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error(result.error || 'Slack API error');
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}`,
      exampleUsage: `
// Send notification to team channel
const result = await ${'{toolName}'}({
  channel: 'general',
  message: 'Deployment completed successfully! 🚀',
  username: 'DeployBot',
  emoji: ':rocket:'
});

if (result.success) {
  console.log('Message sent:', result.messageId);
}`,
      supportedApps: ['slack']
    },
    {
      id: 'email-sender',
      name: 'Email Sender',
      description: 'Send emails with templates and attachments',
      category: 'Communication',
      toolType: 'notification',
      complexity: 'intermediate',
      requiredInputs: [
        { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
        { name: 'subject', type: 'string', required: true, description: 'Email subject' },
        { name: 'body', type: 'string', required: true, description: 'Email body (HTML or text)' },
        { name: 'from', type: 'string', required: false, description: 'Sender email address' },
        { name: 'cc', type: 'array', required: false, description: 'CC recipients' },
        { name: 'attachments', type: 'array', required: false, description: 'File attachments' }
      ],
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', description: 'Email send status' },
          messageId: { type: 'string', description: 'Email message ID' },
          timestamp: { type: 'string', description: 'Send timestamp' }
        }
      },
      codeTemplate: `
export async function ${'{toolName}'}({ to, subject, body, from, cc = [], attachments = [] }) {
  try {
    // Use AWS SES or configured email service
    const emailConfig = await getEmailConfig();

    const emailData = {
      to: Array.isArray(to) ? to : [to],
      subject,
      body,
      from: from || emailConfig.defaultFrom,
      ...(cc.length > 0 && { cc }),
      ...(attachments.length > 0 && { attachments })
    };

    const response = await sendEmail(emailData);

    return {
      success: true,
      messageId: response.messageId,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}`,
      exampleUsage: `
// Send welcome email
const result = await ${'{toolName}'}({
  to: 'user@example.com',
  subject: 'Welcome to our platform!',
  body: '<h1>Welcome!</h1><p>Thanks for joining us.</p>',
  cc: ['manager@company.com']
});

if (result.success) {
  console.log('Email sent:', result.messageId);
}`,
      supportedApps: ['aws-ses', 'sendgrid', 'mailgun']
    },
    {
      id: 'database-query',
      name: 'Database Query Tool',
      description: 'Execute database queries with connection pooling and error handling',
      category: 'Data Storage',
      toolType: 'integration',
      complexity: 'advanced',
      requiredInputs: [
        { name: 'query', type: 'string', required: true, description: 'SQL query to execute' },
        { name: 'params', type: 'array', required: false, description: 'Query parameters' },
        { name: 'database', type: 'string', required: false, description: 'Database name' },
        { name: 'timeout', type: 'number', required: false, description: 'Query timeout in ms', defaultValue: 30000 }
      ],
      outputSchema: {
        type: 'object',
        properties: {
          rows: { type: 'array', description: 'Query result rows' },
          rowCount: { type: 'number', description: 'Number of affected rows' },
          executionTime: { type: 'number', description: 'Query execution time in ms' }
        }
      },
      codeTemplate: `
export async function ${'{toolName}'}({ query, params = [], database, timeout = 30000 }) {
  const startTime = Date.now();

  try {
    const dbConfig = await getDatabaseConfig(database);
    const connection = await getConnection(dbConfig);

    // Set query timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeout);
    });

    const queryPromise = connection.query(query, params);
    const result = await Promise.race([queryPromise, timeoutPromise]);

    const executionTime = Date.now() - startTime;

    return {
      rows: result.rows || result,
      rowCount: result.rowCount || result.length,
      executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    throw new Error(\`Database query failed after \${executionTime}ms: \${error.message}\`);
  }
}`,
      exampleUsage: `
// Query user data
const result = await ${'{toolName}'}({
  query: 'SELECT * FROM users WHERE created_at > $1',
  params: ['2024-01-01'],
  database: 'production'
});

console.log(\`Found \${result.rowCount} users in \${result.executionTime}ms\`);`,
      supportedApps: ['postgresql', 'mysql', 'dynamodb']
    }
  ];

  const categories = createMemo(() => {
    const cats = new Set(toolTemplates.map(template => template.category));
    return ['all', ...Array.from(cats)];
  });

  const filteredTemplates = createMemo(() => {
    return toolTemplates.filter(template => {
      const categoryMatch = selectedCategory() === 'all' || template.category === selectedCategory();
      const complexityMatch = selectedComplexity() === 'all' || template.complexity === selectedComplexity();
      return categoryMatch && complexityMatch;
    });
  });

  const addCustomInput = () => {
    setCustomInputs([
      ...customInputs(),
      {
        name: '',
        type: 'string',
        required: false,
        description: ''
      }
    ]);
  };

  const removeCustomInput = (index: number) => {
    const inputs = customInputs();
    inputs.splice(index, 1);
    setCustomInputs([...inputs]);
  };

  const updateCustomInput = (index: number, field: keyof ToolInput, value: any) => {
    const inputs = customInputs();
    inputs[index] = { ...inputs[index], [field]: value };
    setCustomInputs([...inputs]);
  };

  const generateTool = async () => {
    const template = selectedTemplate();
    if (!template || !toolName()) return;

    setLoading(true);

    try {
      // Combine template inputs with custom inputs
      const allInputs = [...template.requiredInputs, ...customInputs()];

      // Generate input schema
      const inputSchema = {
        type: 'object',
        properties: allInputs.reduce((props, input) => {
          props[input.name] = {
            type: input.type,
            description: input.description,
            ...(input.defaultValue !== undefined && { default: input.defaultValue })
          };
          return props;
        }, {} as any),
        required: allInputs.filter(input => input.required).map(input => input.name)
      };

      // Generate implementation code
      const implementation = template.codeTemplate
        .replace(/\$\{toolName\}/g, toolName())
        .replace(/\$\{\{toolName\}\}/g, toolName());

      // Generate test cases
      const testCases: TestCase[] = [
        {
          name: 'Basic functionality test',
          input: allInputs.reduce((input, param) => {
            if (param.required) {
              input[param.name] = param.defaultValue || `test_${param.name}`;
            }
            return input;
          }, {} as any),
          expectedOutput: template.outputSchema.properties,
          description: `Test basic functionality of ${toolName()}`
        }
      ];

      const generated: GeneratedTool = {
        name: toolName(),
        description: toolDescription() || template.description,
        inputSchema,
        outputSchema: template.outputSchema,
        implementation,
        testCases
      };

      setGeneratedTool(generated);
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to generate tool:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTool = async () => {
    const tool = generatedTool();
    if (!tool) return;

    try {
      setLoading(true);

      // Save tool to KV store via DashboardServer
      const toolKey = `mcp-tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { executeTool } = dashboardServer;
      await executeTool('kv_set', {
        key: toolKey,
        value: JSON.stringify({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          implementation: tool.implementation,
          testCases: tool.testCases,
          createdAt: new Date().toISOString(),
          createdBy: 'user', // TODO: Get actual user ID
          organizationId: currentOrganization()?.slug
        }),
        ttl_hours: 8760 // 1 year
      });

      console.log('MCP tool saved successfully');
      setShowPreview(false);
      setGeneratedTool(null);
      setToolName('');
      setToolDescription('');
      setCustomInputs([]);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Failed to save tool:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="space-y-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">MCP Tool Generator</h2>
            <p class="text-sm text-gray-600 mt-1">
              Create custom MCP tools for your specific workflows and integrations
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-purple-50 rounded-lg p-4">
            <div class="text-2xl font-bold text-purple-600">{toolTemplates.length}</div>
            <div class="text-sm text-purple-600">Available Templates</div>
          </div>
          <div class="bg-blue-50 rounded-lg p-4">
            <div class="text-2xl font-bold text-blue-600">
              {toolTemplates.filter(t => t.complexity === 'beginner').length}
            </div>
            <div class="text-sm text-blue-600">Beginner-Friendly</div>
          </div>
          <div class="bg-green-50 rounded-lg p-4">
            <div class="text-2xl font-bold text-green-600">
              {toolTemplates.filter(t => t.supportedApps.includes('any')).length}
            </div>
            <div class="text-sm text-green-600">Universal Tools</div>
          </div>
        </div>

        <div class="flex flex-wrap gap-4 mb-6">
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={selectedCategory()}
              onInput={(e) => setSelectedCategory(e.currentTarget.value)}
              class="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <For each={categories()}>
                {(category) => (
                  <option value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                )}
              </For>
            </select>
          </div>
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700">Complexity:</label>
            <select
              value={selectedComplexity()}
              onInput={(e) => setSelectedComplexity(e.currentTarget.value)}
              class="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
      </div>

      {/* Template Selection */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <For each={filteredTemplates()}>
          {(template) => (
            <div
              class={`bg-white rounded-lg shadow-sm border-2 p-6 cursor-pointer transition-colors ${
                selectedTemplate()?.id === template.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedTemplate(template)}
            >
              <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                  <h3 class="font-semibold text-gray-900 mb-2">{template.name}</h3>
                  <p class="text-sm text-gray-600 mb-3">{template.description}</p>
                </div>
                <div class={`px-2 py-1 rounded-full text-xs font-medium ${
                  template.complexity === 'beginner' ? 'bg-green-100 text-green-800' :
                  template.complexity === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {template.complexity}
                </div>
              </div>

              <div class="space-y-3">
                <div>
                  <div class="text-xs font-medium text-gray-700 mb-1">Category:</div>
                  <span class="px-2 py-1 rounded-md text-xs bg-purple-100 text-purple-800">
                    {template.category}
                  </span>
                </div>

                <div>
                  <div class="text-xs font-medium text-gray-700 mb-1">Required Inputs:</div>
                  <div class="flex flex-wrap gap-1">
                    <For each={template.requiredInputs.slice(0, 3)}>
                      {(input) => (
                        <span class="px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-600">
                          {input.name}
                        </span>
                      )}
                    </For>
                    <Show when={template.requiredInputs.length > 3}>
                      <span class="px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-600">
                        +{template.requiredInputs.length - 3} more
                      </span>
                    </Show>
                  </div>
                </div>

                <div>
                  <div class="text-xs font-medium text-gray-700 mb-1">Supported Apps:</div>
                  <div class="flex flex-wrap gap-1">
                    <For each={template.supportedApps.slice(0, 2)}>
                      {(app) => (
                        <span class="px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800">
                          {app}
                        </span>
                      )}
                    </For>
                    <Show when={template.supportedApps.length > 2}>
                      <span class="px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800">
                        +{template.supportedApps.length - 2}
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Tool Configuration */}
      <Show when={selectedTemplate()}>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Configure Your Tool</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Tool Name</label>
              <input
                type="text"
                value={toolName()}
                onInput={(e) => setToolName(e.currentTarget.value)}
                placeholder="my_awesome_tool"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                type="text"
                value={toolDescription()}
                onInput={(e) => setToolDescription(e.currentTarget.value)}
                placeholder="What does your tool do?"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Custom Inputs */}
          <div class="mt-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-md font-medium text-gray-900">Additional Inputs</h4>
              <button
                onClick={addCustomInput}
                class="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Add Input
              </button>
            </div>

            <Show when={customInputs().length > 0}>
              <div class="space-y-4">
                <For each={customInputs()}>
                  {(input, index) => (
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border border-gray-200 rounded-md">
                      <input
                        type="text"
                        placeholder="Input name"
                        value={input.name}
                        onInput={(e) => updateCustomInput(index(), 'name', e.currentTarget.value)}
                        class="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <select
                        value={input.type}
                        onInput={(e) => updateCustomInput(index(), 'type', e.currentTarget.value as any)}
                        class="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="array">Array</option>
                        <option value="object">Object</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Description"
                        value={input.description}
                        onInput={(e) => updateCustomInput(index(), 'description', e.currentTarget.value)}
                        class="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <label class="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={input.required}
                          onChange={(e) => updateCustomInput(index(), 'required', e.currentTarget.checked)}
                        />
                        <span class="text-sm">Required</span>
                      </label>
                      <button
                        onClick={() => removeCustomInput(index())}
                        class="px-2 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              onClick={generateTool}
              disabled={loading() || !toolName()}
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Show when={loading()}>
                <span class="inline-block animate-spin mr-2">⚪</span>
              </Show>
              Generate Tool
            </button>
          </div>
        </div>
      </Show>

      {/* Tool Preview Modal */}
      <Show when={showPreview() && generatedTool()}>
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPreview(false)} />

            <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div class="bg-white px-6 pt-6 pb-4">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-medium text-gray-900">Generated MCP Tool Preview</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    class="text-gray-400 hover:text-gray-600"
                  >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div class="space-y-6">
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Tool Implementation</h4>
                    <pre class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{generatedTool()?.implementation}</code>
                    </pre>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 class="font-medium text-gray-900 mb-2">Input Schema</h4>
                      <pre class="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                        <code>{JSON.stringify(generatedTool()?.inputSchema, null, 2)}</code>
                      </pre>
                    </div>

                    <div>
                      <h4 class="font-medium text-gray-900 mb-2">Output Schema</h4>
                      <pre class="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                        <code>{JSON.stringify(generatedTool()?.outputSchema, null, 2)}</code>
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Test Cases</h4>
                    <div class="space-y-3">
                      <For each={generatedTool()?.testCases || []}>
                        {(testCase) => (
                          <div class="border border-gray-200 rounded p-3">
                            <div class="font-medium text-sm text-gray-900">{testCase.name}</div>
                            <div class="text-xs text-gray-600 mb-2">{testCase.description}</div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div class="text-xs font-medium text-gray-700">Input:</div>
                                <pre class="bg-gray-50 p-2 rounded text-xs">
                                  <code>{JSON.stringify(testCase.input, null, 2)}</code>
                                </pre>
                              </div>
                              <div>
                                <div class="text-xs font-medium text-gray-700">Expected Output:</div>
                                <pre class="bg-gray-50 p-2 rounded text-xs">
                                  <code>{JSON.stringify(testCase.expectedOutput, null, 2)}</code>
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
                <button
                  onClick={() => setShowPreview(false)}
                  class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTool}
                  disabled={loading()}
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Show when={loading()}>
                    <span class="inline-block animate-spin mr-2">⚪</span>
                  </Show>
                  Save Tool
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}