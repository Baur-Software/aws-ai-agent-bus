/**
 * Storage Node Definitions
 * S3/Artifacts nodes
 */

import type { NodeDefinition } from '../NodeRegistry';

export const STORAGE_NODES: NodeDefinition[] = [
  {
    type: 'artifacts-list',
    name: 'List Artifacts',
    description: 'List files in S3 storage',
    category: 'data',
    subcategory: 's3',
    icon: '📁',
    color: 'bg-blue-500',
    fields: [
      {
        key: 'prefix',
        label: 'Prefix/Path',
        type: 'text',
        placeholder: 'reports/',
        help: 'Filter results by path prefix'
      }
    ],
    sampleOutput: {
      artifacts: [
        { key: 'reports/monthly-report.pdf', size: 2048576, lastModified: '2025-09-29T15:30:00Z' },
        { key: 'reports/weekly-summary.xlsx', size: 512000, lastModified: '2025-09-28T10:15:00Z' },
        { key: 'images/logo.png', size: 45120, lastModified: '2025-09-25T08:00:00Z' }
      ],
      count: 3,
      prefix: 'reports/'
    }
  },
  {
    type: 'artifacts-get',
    name: 'Get Artifact',
    description: 'Download file from S3 storage',
    category: 'data',
    subcategory: 's3',
    icon: '📥',
    color: 'bg-green-500',
    fields: [
      {
        key: 'key',
        label: 'File Path',
        type: 'text',
        required: true,
        placeholder: 'reports/monthly-report.pdf',
        help: 'Full path to the file in S3'
      }
    ],
    sampleOutput: {
      key: 'reports/monthly-report.pdf',
      content: 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlIC9QYXJlbnQgMSAwIFI...',
      contentType: 'application/pdf',
      size: 2048576,
      lastModified: '2025-09-29T15:30:00Z'
    }
  },
  {
    type: 'artifacts-put',
    name: 'Upload Artifact',
    description: 'Upload file to S3 storage',
    category: 'data',
    subcategory: 's3',
    icon: '📤',
    color: 'bg-orange-500',
    fields: [
      {
        key: 'key',
        label: 'File Path',
        type: 'text',
        required: true,
        placeholder: 'uploads/document.txt',
        help: 'Destination path in S3'
      },
      {
        key: 'content',
        label: 'Content',
        type: 'textarea',
        required: true,
        help: 'File content to upload'
      },
      {
        key: 'contentType',
        label: 'Content Type',
        type: 'text',
        defaultValue: 'text/plain',
        placeholder: 'text/plain',
        help: 'MIME type of the file'
      }
    ],
    defaultConfig: {
      contentType: 'text/plain'
    },
    sampleOutput: {
      success: true,
      key: 'uploads/document.txt',
      size: 1024,
      url: 'https://s3.amazonaws.com/bucket/uploads/document.txt'
    }
  }
];
