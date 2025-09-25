import type { AppConfig } from '../contexts/KVStoreContext';

// OAuth2 flow templates - compact following token-economy principles
export const OAUTH2_TEMPLATES = {
  google: {
    auth_url: 'https://accounts.google.com/o/oauth2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    base_scopes: ['openid', 'email', 'profile']
  },
  microsoft: {
    auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    base_scopes: ['openid', 'email', 'profile']
  },
  github: {
    auth_url: 'https://github.com/login/oauth/authorize',
    token_url: 'https://github.com/login/oauth/access_token',
    base_scopes: ['user:email']
  },
  slack: {
    auth_url: 'https://slack.com/oauth/v2/authorize',
    token_url: 'https://slack.com/api/oauth.v2.access',
    base_scopes: ['openid', 'email']
  },
  discord: {
    auth_url: 'https://discord.com/api/oauth2/authorize',
    token_url: 'https://discord.com/api/oauth2/token',
    base_scopes: ['identify', 'email']
  },
  salesforce: {
    auth_url: 'https://login.salesforce.com/services/oauth2/authorize',
    token_url: 'https://login.salesforce.com/services/oauth2/token',
    base_scopes: ['api', 'refresh_token']
  },
  stripe: {
    auth_url: 'https://connect.stripe.com/oauth/authorize',
    token_url: 'https://connect.stripe.com/oauth/token',
    base_scopes: ['read_write']
  }
};

// Common field templates
export const FIELD_TEMPLATES = {
  client_credentials: [
    { key: 'client_id', label: 'Client ID', type: 'text' as const, required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password' as const, required: true }
  ],
  api_key: [
    { key: 'api_key', label: 'API Key', type: 'password' as const, required: true }
  ],
  bearer_token: [
    { key: 'access_token', label: 'Access Token', type: 'password' as const, required: true }
  ]
};

/**
 * Generate OAuth2 app config from minimal input
 */
export function generateOAuth2Config(input: {
  id: string;
  name: string;
  category: string;
  description: string;
  provider?: keyof typeof OAUTH2_TEMPLATES;
  custom_auth_url?: string;
  custom_token_url?: string;
  scopes?: string[];
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

  const { id, name, category, description, provider, custom_auth_url, custom_token_url, scopes = [], additional_fields = [], workflow_capabilities = [], docs_url } = input;

  // Get OAuth2 template or use custom URLs
  let oauth2_config;
  if (provider && OAUTH2_TEMPLATES[provider]) {
    const template = OAUTH2_TEMPLATES[provider];
    oauth2_config = {
      auth_url: custom_auth_url || template.auth_url,
      token_url: custom_token_url || template.token_url,
      scopes: scopes.length > 0 ? scopes : template.base_scopes,
      redirect_uri: 'http://localhost:3000/oauth/callback'
    };
  } else if (custom_auth_url && custom_token_url) {
    oauth2_config = {
      auth_url: custom_auth_url,
      token_url: custom_token_url,
      scopes,
      redirect_uri: 'http://localhost:3000/oauth/callback'
    };
  }

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
 * Quick generators for popular platforms
 */
export const QUICK_GENERATORS = {
  google_service: (service: string, scopes: string[]) => generateOAuth2Config({
    id: `google-${service.toLowerCase()}`,
    name: `Google ${service}`,
    category: 'Google',
    description: `Google ${service} integration`,
    provider: 'google',
    scopes,
    workflow_capabilities: [`google-${service.toLowerCase()}`]
  }),

  microsoft_service: (service: string, scopes: string[]) => generateOAuth2Config({
    id: `microsoft-${service.toLowerCase()}`,
    name: `Microsoft ${service}`,
    category: 'Microsoft',
    description: `Microsoft ${service} integration`,
    provider: 'microsoft',
    scopes,
    workflow_capabilities: [`microsoft-${service.toLowerCase()}`]
  }),

  generic_api: (name: string, category: string) => generateAPIKeyConfig({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    category,
    description: `${name} API integration`,
    workflow_capabilities: [name.toLowerCase().replace(/\s+/g, '-')]
  })
};