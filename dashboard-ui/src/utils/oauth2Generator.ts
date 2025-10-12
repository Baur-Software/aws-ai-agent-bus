import type { AppConfig } from '../contexts/KVStoreContext';

// Common field templates
export const FIELD_TEMPLATES: {
  client_credentials: Array<{ key: string; label: string; type: 'text' | 'password' | 'url' | 'email' | 'textarea'; required: boolean; placeholder?: string; help?: string; }>;
  api_key: Array<{ key: string; label: string; type: 'text' | 'password' | 'url' | 'email' | 'textarea'; required: boolean; placeholder?: string; help?: string; }>;
  bearer_token: Array<{ key: string; label: string; type: 'text' | 'password' | 'url' | 'email' | 'textarea'; required: boolean; placeholder?: string; help?: string; }>;
} = {
  client_credentials: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true }
  ],
  api_key: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true }
  ],
  bearer_token: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true }
  ]
};

/**
 * Generate OAuth2 app config from minimal input
 * All OAuth2 configs are now dynamic - provide auth_url and token_url directly
 */
export function generateOAuth2Config(input: {
  id: string;
  name: string;
  category: string;
  description: string;
  auth_url: string;
  token_url: string;
  scopes: string[];
  additional_fields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'email';
    required?: boolean;
    placeholder?: string;
  }>;
  workflow_capabilities?: string[];
  docs_url?: string;
}): AppConfig {

  const { id, name, category, description, auth_url, token_url, scopes = [], additional_fields = [], workflow_capabilities = [], docs_url } = input;

  // Build OAuth2 config with provided URLs
  const oauth2_config = {
    auth_url,
    token_url,
    scopes,
    redirect_uri: 'http://localhost:3000/oauth/callback'
  };

  // Build UI fields
  const ui_fields = [
    ...FIELD_TEMPLATES.client_credentials,
    ...additional_fields
  ];

  return {
    id,
    name,
    category,
    description,
    type: 'oauth2',
    oauth2_config,
    ui_fields,
    workflow_capabilities,
    docsUrl: docs_url,
    verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Generate API key config
 */
export function generateAPIKeyConfig(input: {
  id: string;
  name: string;
  category: string;
  description: string;
  fields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'email';
    required?: boolean;
  }>;
  workflow_capabilities?: string[];
  docs_url?: string;
}): AppConfig {

  const { id, name, category, description, fields = [], workflow_capabilities = [], docs_url } = input;

  return {
    id,
    name,
    category,
    description,
    type: 'api_key',
    ui_fields: fields.length > 0 ? fields : FIELD_TEMPLATES.api_key,
    workflow_capabilities,
    docsUrl: docs_url,
    verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Generate OAuth2 authorization URL
 */
export function generateAuthUrl(config: AppConfig, state?: string): string {
  if (config.type !== 'oauth2' || !config.oauth2_config) {
    throw new Error('Config must be OAuth2 type with oauth2_config');
  }

  const { auth_url, scopes, redirect_uri } = config.oauth2_config;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: '{CLIENT_ID}', // Template - will be replaced with actual client_id
    redirect_uri,
    scope: scopes.join(' '),
    ...(state && { state })
  });

  return `${auth_url}?${params}`;
}

/**
 * Validate OAuth2 config
 */
export function validateOAuth2Config(config: Partial<AppConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.id) errors.push('ID is required');
  if (!config.name) errors.push('Name is required');
  if (!config.category) errors.push('Category is required');
  if (!config.description) errors.push('Description is required');

  if (config.type === 'oauth2') {
    if (!config.oauth2_config) {
      errors.push('OAuth2 config is required');
    } else {
      if (!config.oauth2_config.auth_url) errors.push('Auth URL is required');
      if (!config.oauth2_config.token_url) errors.push('Token URL is required');
      if (!config.oauth2_config.scopes?.length) errors.push('At least one scope is required');
    }
  }

  if (!config.ui_fields?.length) {
    errors.push('At least one UI field is required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Quick generator for generic API key integrations
 */
export const QUICK_GENERATORS = {
  generic_api: (name: string, category: string) => generateAPIKeyConfig({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    category,
    description: `${name} API integration`,
    workflow_capabilities: [name.toLowerCase().replace(/\s+/g, '-')]
  })
};