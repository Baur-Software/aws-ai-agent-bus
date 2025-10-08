/**
 * AI Agent Node Definitions
 *
 * NOTE: These AI/Agent nodes require an agent execution framework to be implemented.
 * Current MCP server does not provide agent execution tools - only infrastructure tools.
 *
 * To enable these nodes, you'll need:
 * 1. Agent execution framework (e.g., LangChain, Claude API integration)
 * 2. Workflow executor that handles agent orchestration
 * 3. Token/credit management for LLM API calls
 *
 * For now, these serve as node templates for future implementation.
 */

import type { NodeDefinition } from '../NodeRegistry';

export const AI_NODES: NodeDefinition[] = [
  // Generic Agent Node
  {
    type: 'agent',
    name: 'Agent',
    description: 'AI agent task executor',
    category: 'ai',
    subcategory: 'operations',
    icon: '🤖',
    color: 'bg-purple-600',
    hasAgentConfig: true,
    fields: [
      {
        key: 'agentId',
        label: 'Agent',
        type: 'select',
        required: true,
        help: 'Select an agent to execute'
      },
      {
        key: 'prompt',
        label: 'Additional Instructions',
        type: 'textarea',
        placeholder: 'Provide additional context or instructions...',
        help: 'Optional instructions to guide the agent'
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        defaultValue: 'claude-3-5-sonnet-20241022',
        options: [
          { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
          { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
          { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' }
        ]
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 0.7,
        help: 'Controls randomness (0-1)'
      }
    ],
    defaultConfig: {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7
    },
    outputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent identifier' },
        result: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['completed', 'failed', 'partial'] },
            output: { type: 'string', description: 'Agent output text' },
            artifacts: {
              type: 'array',
              items: { type: 'string' },
              description: 'Generated artifacts/files'
            },
            thinking: { type: 'string', description: 'Agent reasoning process' }
          },
          required: ['status', 'output']
        },
        tokensUsed: { type: 'number', description: 'LLM tokens consumed' },
        duration: { type: 'number', description: 'Execution time in seconds' }
      },
      required: ['agentId', 'result']
    }
  },

  // Orchestration Agents
  {
    type: 'agent-conductor',
    name: 'Conductor Agent',
    description: 'Goal-driven planning and task delegation',
    category: 'ai',
    subcategory: 'orchestration',
    icon: '🎯',
    color: 'bg-indigo-500',
    hasAgentConfig: true,
    fields: [
      {
        key: 'goal',
        label: 'Goal Description',
        type: 'textarea',
        required: true,
        placeholder: 'Describe the goal to achieve...',
        help: 'The high-level goal for the conductor to achieve'
      },
      {
        key: 'context',
        label: 'Context',
        type: 'textarea',
        placeholder: 'Additional context or constraints...',
        help: 'Background information to guide decision-making'
      },
      {
        key: 'maxSubtasks',
        label: 'Max Subtasks',
        type: 'number',
        defaultValue: 5,
        help: 'Maximum number of subtasks to delegate'
      },
      {
        key: 'timeout',
        label: 'Timeout (seconds)',
        type: 'number',
        defaultValue: 300,
        help: 'Maximum execution time'
      }
    ],
    defaultConfig: {
      maxSubtasks: 5,
      timeout: 300
    },
    sampleOutput: {
      plan: {
        subtasks: [
          { task: 'Research APIs', assigned: 'agent-researcher' },
          { task: 'Design schema', assigned: 'agent-architect' }
        ]
      },
      status: 'delegated',
      completedTasks: 0,
      totalTasks: 2
    }
  },
  {
    type: 'agent-critic',
    name: 'Critic Agent',
    description: 'Safety validation and risk assessment',
    category: 'ai',
    subcategory: 'orchestration',
    icon: '🛡️',
    color: 'bg-red-500',
    hasAgentConfig: true,
    fields: [
      {
        key: 'validationRules',
        label: 'Validation Rules',
        type: 'textarea',
        placeholder: 'List validation criteria...',
        help: 'Rules to check against (one per line)'
      },
      {
        key: 'riskThreshold',
        label: 'Risk Threshold',
        type: 'select',
        defaultValue: 'medium',
        options: [
          { label: 'Low (permissive)', value: 'low' },
          { label: 'Medium (balanced)', value: 'medium' },
          { label: 'High (strict)', value: 'high' }
        ]
      },
      {
        key: 'requireApproval',
        label: 'Require Human Approval',
        type: 'checkbox',
        defaultValue: false,
        help: 'Pause workflow for human review if risks detected'
      }
    ],
    defaultConfig: {
      riskThreshold: 'medium',
      requireApproval: false
    },
    sampleOutput: {
      riskLevel: 'low',
      issues: [],
      approved: true,
      recommendations: ['Consider adding rate limiting']
    }
  },

  // Specialist Agents
  {
    type: 'agent-terraform',
    name: 'Terraform Expert',
    description: 'Infrastructure as code specialist',
    category: 'ai',
    subcategory: 'specialist',
    icon: '🏗️',
    color: 'bg-purple-500',
    hasAgentConfig: true,
    fields: [
      {
        key: 'workspace',
        label: 'Terraform Workspace',
        type: 'text',
        placeholder: 'dev'
      },
      {
        key: 'variables',
        label: 'Variables',
        type: 'json',
        placeholder: '{"region": "us-west-2"}',
        help: 'Terraform variables as JSON'
      },
      {
        key: 'autoApply',
        label: 'Auto Apply Changes',
        type: 'checkbox',
        defaultValue: false,
        help: 'Automatically apply planned changes (use with caution)'
      }
    ],
    defaultConfig: {
      autoApply: false
    },
    sampleOutput: {
      plan: '+ aws_instance.example',
      changes: { add: 1, change: 0, destroy: 0 },
      applied: false
    }
  },
  {
    type: 'agent-django',
    name: 'Django Expert',
    description: 'Django/Python backend specialist',
    category: 'ai',
    subcategory: 'specialist',
    icon: '🐍',
    color: 'bg-green-600',
    hasAgentConfig: true,
    fields: [
      {
        key: 'task',
        label: 'Task Description',
        type: 'textarea',
        required: true,
        placeholder: 'Create a REST API endpoint for...'
      },
      {
        key: 'context',
        label: 'Project Context',
        type: 'textarea',
        help: 'Information about your Django project structure'
      }
    ],
    sampleOutput: {
      code: '# Generated Django code...',
      files: ['views.py', 'serializers.py', 'urls.py'],
      tests: '# Generated tests...'
    }
  },
  {
    type: 'agent-react',
    name: 'React Expert',
    description: 'React/Frontend specialist',
    category: 'ai',
    subcategory: 'specialist',
    icon: '⚛️',
    color: 'bg-blue-400',
    hasAgentConfig: true,
    fields: [
      {
        key: 'task',
        label: 'Component Task',
        type: 'textarea',
        required: true,
        placeholder: 'Build a responsive navbar with...'
      },
      {
        key: 'framework',
        label: 'Framework',
        type: 'select',
        defaultValue: 'react',
        options: [
          { label: 'React', value: 'react' },
          { label: 'Next.js', value: 'nextjs' },
          { label: 'Remix', value: 'remix' }
        ]
      },
      {
        key: 'styling',
        label: 'Styling',
        type: 'select',
        defaultValue: 'tailwind',
        options: [
          { label: 'Tailwind CSS', value: 'tailwind' },
          { label: 'CSS Modules', value: 'css-modules' },
          { label: 'Styled Components', value: 'styled-components' }
        ]
      }
    ],
    defaultConfig: {
      framework: 'react',
      styling: 'tailwind'
    },
    sampleOutput: {
      component: '// Generated React component...',
      tests: '// Generated tests...',
      storybook: '// Storybook story...'
    }
  },

  // AI Operations
  {
    type: 'ai-prompt',
    name: 'AI Prompt',
    description: 'Send prompt to AI model',
    category: 'ai',
    subcategory: 'operations',
    icon: '🤖',
    color: 'bg-violet-500',
    hasAgentConfig: true,
    fields: [
      {
        key: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
        placeholder: 'Enter your prompt...'
      },
      {
        key: 'systemPrompt',
        label: 'System Prompt',
        type: 'textarea',
        placeholder: 'You are a helpful assistant...',
        help: 'System instructions for the AI'
      }
    ],
    sampleOutput: {
      response: 'AI-generated response...',
      model: 'claude-3-sonnet',
      tokens: { input: 100, output: 150 }
    }
  },
  {
    type: 'ai-classify',
    name: 'AI Classifier',
    description: 'Classify text with AI',
    category: 'ai',
    subcategory: 'operations',
    icon: '🏷️',
    color: 'bg-pink-500',
    hasAgentConfig: true,
    fields: [
      {
        key: 'text',
        label: 'Text to Classify',
        type: 'textarea',
        required: true
      },
      {
        key: 'categories',
        label: 'Categories',
        type: 'json',
        required: true,
        placeholder: '["positive", "negative", "neutral"]',
        help: 'Array of possible categories'
      }
    ],
    sampleOutput: {
      category: 'positive',
      confidence: 0.95,
      allScores: {
        positive: 0.95,
        negative: 0.03,
        neutral: 0.02
      }
    }
  },
  {
    type: 'ai-extract',
    name: 'AI Extractor',
    description: 'Extract structured data from text',
    category: 'ai',
    subcategory: 'operations',
    icon: '📊',
    color: 'bg-teal-500',
    hasAgentConfig: true,
    fields: [
      {
        key: 'text',
        label: 'Source Text',
        type: 'textarea',
        required: true
      },
      {
        key: 'schema',
        label: 'Output Schema',
        type: 'json',
        required: true,
        placeholder: '{"name": "string", "email": "string", "age": "number"}',
        help: 'JSON schema for extracted data'
      }
    ],
    sampleOutput: {
      extracted: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      },
      confidence: 0.92
    }
  }
];
