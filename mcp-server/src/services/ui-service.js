import AnalyticsDashboard from '../ui/analytics-dashboard.js';

/**
 * UI Service for generating interactive MCP UI resources
 * Follows 12-factor app principles - enabled/disabled via environment variables
 */
export class UIService {
  
  constructor() {
    // UI generation is controlled by environment variables
    this.enabled = process.env.MCP_UI_ENABLED === 'true';
    this.baseUrl = process.env.MCP_UI_BASE_URL || 'http://localhost:3000';
    
    if (this.enabled) {
      console.log('✅ MCP UI Service enabled');
    } else {
      console.log('ℹ️  MCP UI Service disabled (set MCP_UI_ENABLED=true to enable)');
    }
  }

  /**
   * Generate UI resource for analytics data if UI service is enabled
   * @param {string} type - Type of UI resource to generate
   * @param {*} data - Data to visualize
   * @param {*} metadata - Metadata for the resource
   * @returns {Object|null} UI resource or null if disabled
   */
  generateUIResource(type, data, metadata) {
    if (!this.enabled) {
      return null;
    }

    try {
      switch (type) {
        case 'users-by-country':
          return AnalyticsDashboard.createUsersByCountryDashboard(data, metadata);
        
        case 'content-calendar':
          return AnalyticsDashboard.createContentCalendarDashboard(data, metadata);
        
        default:
          console.warn(`Unknown UI resource type: ${type}`);
          return null;
      }
    } catch (error) {
      console.error('Failed to generate UI resource:', error);
      return null;
    }
  }

  /**
   * Check if UI service is enabled
   * @returns {boolean} True if UI generation is enabled
   */
  isEnabled() {
    return this.enabled;
  }
}

// Singleton instance
export const uiService = new UIService();
export default uiService;