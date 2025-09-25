import { AppConfig } from '../contexts/KVStoreContext';
import {
  BarChart3, Github, Slack, CreditCard, Database, Users, Building,
  Mail, Calendar, FileText, Globe, MessageSquare, Camera, Music,
  ShoppingCart, Truck, DollarSign, Zap, Video, Phone, Code
} from 'lucide-solid';

// Compact OAuth2 app configs following token-economy principles
export const MARKETPLACE_CONFIGS: AppConfig[] = [
  // Analytics & Marketing
  { id: 'google-analytics', name: 'Google Analytics', category: 'Analytics', icon: 'BarChart3', color: 'bg-orange-500',
    description: 'Website metrics and reporting', type: 'oauth2',
    oauth2_config: { auth_url: 'https://accounts.google.com/o/oauth2/auth', token_url: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'property_id', label: 'GA4 Property ID', type: 'text', required: true }
    ], workflow_capabilities: ['ga-top-pages', 'ga-search-data'], verified: true },

  { id: 'facebook-ads', name: 'Facebook Ads', category: 'Marketing', icon: 'Camera', color: 'bg-blue-600',
    description: 'Facebook advertising and insights', type: 'oauth2',
    oauth2_config: { auth_url: 'https://www.facebook.com/v18.0/dialog/oauth', token_url: 'https://graph.facebook.com/v18.0/oauth/access_token',
      scopes: ['ads_read', 'read_insights'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'app_id', label: 'App ID', type: 'text', required: true },
      { key: 'app_secret', label: 'App Secret', type: 'password', required: true },
      { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', required: true }
    ], workflow_capabilities: ['facebook-campaign-stats', 'facebook-audience-insights'], verified: true },

  // CRM & Sales
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', icon: 'Building', color: 'bg-blue-500',
    description: 'Customer relationship management', type: 'oauth2',
    oauth2_config: { auth_url: 'https://login.salesforce.com/services/oauth2/authorize', token_url: 'https://login.salesforce.com/services/oauth2/token',
      scopes: ['api', 'refresh_token'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'Consumer Key', type: 'text', required: true },
      { key: 'client_secret', label: 'Consumer Secret', type: 'password', required: true },
      { key: 'instance_url', label: 'Instance URL', type: 'url', required: true }
    ], workflow_capabilities: ['salesforce-leads', 'salesforce-opportunities'], verified: true },

  { id: 'hubspot', name: 'HubSpot', category: 'CRM', icon: 'Users', color: 'bg-orange-600',
    description: 'Inbound marketing and sales', type: 'oauth2',
    oauth2_config: { auth_url: 'https://app.hubspot.com/oauth/authorize', token_url: 'https://api.hubapi.com/oauth/v1/token',
      scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'portal_id', label: 'Portal ID', type: 'text', required: true }
    ], workflow_capabilities: ['hubspot-contacts', 'hubspot-deals'], verified: true },

  // Communication
  { id: 'slack', name: 'Slack', category: 'Communication', icon: 'Slack', color: 'bg-green-500',
    description: 'Team messaging and collaboration', type: 'oauth2',
    oauth2_config: { auth_url: 'https://slack.com/oauth/v2/authorize', token_url: 'https://slack.com/api/oauth.v2.access',
      scopes: ['chat:write', 'channels:read'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'workspace_url', label: 'Workspace URL', type: 'url', required: false }
    ], workflow_capabilities: ['slack-message', 'slack-channel-list'], verified: true },

  { id: 'discord', name: 'Discord', category: 'Communication', icon: 'MessageSquare', color: 'bg-indigo-600',
    description: 'Gaming and community chat', type: 'oauth2',
    oauth2_config: { auth_url: 'https://discord.com/api/oauth2/authorize', token_url: 'https://discord.com/api/oauth2/token',
      scopes: ['bot', 'messages.read'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'Application ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'bot_token', label: 'Bot Token', type: 'password', required: true }
    ], workflow_capabilities: ['discord-message', 'discord-server-info'], verified: true },

  // Development
  { id: 'github', name: 'GitHub', category: 'Development', icon: 'Github', color: 'bg-gray-800',
    description: 'Code repositories and collaboration', type: 'oauth2',
    oauth2_config: { auth_url: 'https://github.com/login/oauth/authorize', token_url: 'https://github.com/login/oauth/access_token',
      scopes: ['repo', 'user'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'organization', label: 'Organization', type: 'text', required: false }
    ], workflow_capabilities: ['github-repos', 'github-issues', 'github-prs'], verified: true },

  // Productivity
  { id: 'notion', name: 'Notion', category: 'Productivity', icon: 'FileText', color: 'bg-gray-900',
    description: 'All-in-one workspace', type: 'oauth2',
    oauth2_config: { auth_url: 'https://api.notion.com/v1/oauth/authorize', token_url: 'https://api.notion.com/v1/oauth/token',
      scopes: ['read', 'update'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true }
    ], workflow_capabilities: ['notion-pages', 'notion-databases'], verified: true },

  { id: 'airtable', name: 'Airtable', category: 'Productivity', icon: 'Database', color: 'bg-yellow-500',
    description: 'Spreadsheet-database hybrid', type: 'oauth2',
    oauth2_config: { auth_url: 'https://airtable.com/oauth2/v1/authorize', token_url: 'https://airtable.com/oauth2/v1/token',
      scopes: ['data.records:read', 'data.records:write'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true }
    ], workflow_capabilities: ['airtable-records', 'airtable-bases'], verified: true },

  // Payments & E-commerce
  { id: 'stripe', name: 'Stripe', category: 'Payments', icon: 'CreditCard', color: 'bg-purple-500',
    description: 'Online payment processing', type: 'oauth2',
    oauth2_config: { auth_url: 'https://connect.stripe.com/oauth/authorize', token_url: 'https://connect.stripe.com/oauth/token',
      scopes: ['read_write'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'publishable_key', label: 'Publishable Key', type: 'text', required: true }
    ], workflow_capabilities: ['stripe-payments', 'stripe-customers'], verified: true },

  { id: 'shopify', name: 'Shopify', category: 'E-commerce', icon: 'ShoppingCart', color: 'bg-green-600',
    description: 'E-commerce platform', type: 'oauth2',
    oauth2_config: { auth_url: 'https://{shop}.myshopify.com/admin/oauth/authorize', token_url: 'https://{shop}.myshopify.com/admin/oauth/access_token',
      scopes: ['read_products', 'read_orders'], redirect_uri: 'http://localhost:3000/oauth/callback' },
    ui_fields: [
      { key: 'api_key', label: 'API Key', type: 'text', required: true },
      { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
      { key: 'shop_domain', label: 'Shop Domain', type: 'text', required: true, placeholder: 'mystore.myshopify.com' }
    ], workflow_capabilities: ['shopify-products', 'shopify-orders'], verified: true }
];