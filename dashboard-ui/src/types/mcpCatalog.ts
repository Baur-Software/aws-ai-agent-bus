// Types for MCP Server Catalog Integration
// Based on external registries like mcpservers.org

export interface ConfigurationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'file' | 'select' | 'boolean' | 'url' | 'number';
  required: boolean;
  description: string;
  placeholder?: string;
  validation?: string; // regex pattern for validation
  options?: string[]; // for select fields
  defaultValue?: any;
  sensitive?: boolean; // for fields that should be encrypted
}

export interface MCPServerListing {
  id: string;
  name: string;
  description: string;
  publisher: string;
  version: string;

  // Verification and trust
  isOfficial: boolean;
  isSigned: boolean;
  verificationBadges: ('official' | 'signed' | 'popular' | 'verified')[];

  // Repository and metadata
  repository: string;
  homepage?: string;
  documentation?: string;
  downloadCount: number;
  starCount: number;
  lastUpdated: Date;

  // Categorization
  category: 'Analytics' | 'CRM' | 'Development' | 'Database' | 'Communication' | 'Enterprise' | 'Other';
  tags: string[];

  // Configuration and setup
  configurationSchema: ConfigurationField[];
  authMethods: ('oauth2' | 'api_key' | 'basic' | 'certificate' | 'none')[];

  // Runtime information
  toolCount: number;
  capabilities: string[];

  // Installation
  installCommand?: string;
  dockerImage?: string;
  npmPackage?: string;
}

export interface MCPServerConnection {
  id: string;
  userId: string;
  organizationId: string;
  serverId: string; // Reference to MCPServerListing.id
  serverName: string;

  // Configuration values (encrypted)
  configuration: Record<string, any>;

  // Connection status
  status: 'connected' | 'disconnected' | 'error' | 'configuring';
  lastConnected?: Date;
  lastError?: string;

  // Authentication
  authMethod: 'oauth2' | 'api_key' | 'basic' | 'certificate' | 'none';
  authConfig?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string[];
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface MCPCatalogRegistry {
  name: string;
  url: string;
  description: string;
  isOfficial: boolean;
  lastSync?: Date;
}

export interface MCPServerCapability {
  name: string;
  description: string;
  inputSchema?: any; // JSON schema for inputs
  outputSchema?: any; // JSON schema for outputs
  category: string;
  examples?: any[];
}

export interface MCPServerHealth {
  serverId: string;
  connectionId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
  error?: string;
  capabilities: MCPServerCapability[];
}

// Catalog API response types
export interface CatalogResponse {
  servers: MCPServerListing[];
  total: number;
  page: number;
  limit: number;
  registries: MCPCatalogRegistry[];
}

export interface ServerDetailsResponse extends MCPServerListing {
  readme?: string;
  changelog?: string[];
  dependencies?: string[];
  screenshots?: string[];
}

// Search and filtering
export interface MCPCatalogFilters {
  category?: string;
  verified?: boolean;
  official?: boolean;
  search?: string;
  tags?: string[];
  authMethods?: string[];
}

export interface MCPCatalogSort {
  field: 'name' | 'downloadCount' | 'starCount' | 'lastUpdated' | 'popularity';
  direction: 'asc' | 'desc';
}