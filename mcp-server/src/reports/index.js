/**
 * Google Analytics Reports Module
 * 
 * This module provides pre-built analytics reports that can be executed
 * standalone or integrated into other applications.
 * 
 * @module reports
 */

import { generateUsersReport } from './users-by-country.js';

/**
 * Available report functions
 * 
 * @typedef {Object} ReportModule
 * @property {Function} usersByCountry - Generate users by country report
 */

export const reports = {
  /**
   * Generate a comprehensive users by country report for the last 30 days
   * 
   * @async
   * @function usersByCountry
   * @param {Object} [options] - Report options
   * @param {number} [options.days=30] - Number of days to analyze
   * @param {string} [options.propertyId] - GA4 property ID (overrides secret)
   * @returns {Promise<Object>} Report data object
   * @throws {Error} If AWS credentials or GA secret is unavailable
   * 
   * @example
   * import { reports } from './src/reports/index.js';
   * 
   * const report = await reports.usersByCountry({ days: 30 });
   * console.table(report.data);
   */
  usersByCountry: generateUsersReport
};

/**
 * Report metadata and configuration
 */
export const reportConfig = {
  usersByCountry: {
    name: 'Users by Country Report',
    description: 'Analyzes unique users segmented by geographic location',
    metrics: ['totalUsers', 'activeUsers', 'sessions', 'engagementRate'],
    dimensions: ['country', 'countryId'],
    defaultDays: 30,
    maxCountries: 100,
    requires: ['aws-credentials', 'google-analytics-secret']
  }
};

/**
 * List all available reports with metadata
 * 
 * @returns {Array<Object>} Array of report configurations
 * @example
 * import { listReports } from './src/reports/index.js';
 * 
 * const availableReports = listReports();
 * console.log(availableReports);
 */
export function listReports() {
  return Object.keys(reportConfig).map(key => ({
    id: key,
    ...reportConfig[key]
  }));
}

export default reports;