/**
 * Docker/Compute Node Definitions
 * Container execution nodes (runs on AWS ECS Fargate)
 */

import type { NodeDefinition } from '../NodeRegistry';

export const DOCKER_NODES: NodeDefinition[] = [
  {
    type: 'docker-run',
    name: 'Docker Container',
    description: 'Execute a Docker container on AWS ECS Fargate',
    category: 'actions',
    subcategory: 'compute',
    icon: '🐳',
    color: 'bg-blue-600',
    hasDedicatedComponent: true,
    componentName: 'DockerNodeConfig',
    fields: [
      {
        key: 'image',
        label: 'Container Image',
        type: 'text',
        required: true,
        placeholder: 'nginx:latest',
        help: 'Docker image name and tag'
      },
      {
        key: 'tag',
        label: 'Tag',
        type: 'text',
        defaultValue: 'latest',
        placeholder: 'latest',
        help: 'Image tag version'
      },
      {
        key: 'command',
        label: 'Command',
        type: 'textarea',
        placeholder: '/bin/sh -c "echo Hello"',
        help: 'Command to run in the container (optional)'
      },
      {
        key: 'environment',
        label: 'Environment Variables',
        type: 'json',
        placeholder: '{"VAR1": "value1", "VAR2": "value2"}',
        help: 'Environment variables as JSON object'
      }
    ],
    defaultConfig: {
      tag: 'latest'
    },
    outputSchema: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'ECS Task ARN' },
        exitCode: { type: 'number', description: 'Container exit code' },
        stdout: { type: 'string', description: 'Standard output from CloudWatch Logs' },
        stderr: { type: 'string', description: 'Standard error from CloudWatch Logs' },
        duration: { type: 'number', description: 'Execution time in seconds' },
        startedAt: { type: 'string', format: 'date-time' },
        finishedAt: { type: 'string', format: 'date-time' }
      },
      required: ['containerId', 'exitCode']
    }
  }
];
