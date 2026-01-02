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
 * Report options for users by country
 */
export interface UsersByCountryOptions {
  /** Number of days to analyze (default: 30) */
  days?: number;
  /** GA4 property ID (overrides secret) */
  propertyId?: string;
}

/**
 * Report configuration metadata
 */
export interface ReportConfigItem {
  name: string;
  description: string;
  metrics: string[];
  dimensions: string[];
  defaultDays: number;
  maxCountries: number;
  requires: string[];
}

/**
 * Report listing with ID
 */
export interface ReportListing extends ReportConfigItem {
  id: string;
}

/**
 * Available report functions
 */
export const reports = {
  /**
   * Generate a comprehensive users by country report for the last 30 days
   *
   * @async
   * @function usersByCountry
   * @param options - Report options
   * @returns Report data object
   * @throws If AWS credentials or GA secret is unavailable
   *
   * @example
   * import { reports } from './src/reports/index.js';
   *
   * const report = await reports.usersByCountry({ days: 30 });
   * console.table(report.data);
   */
  usersByCountry: generateUsersReport,
};

/**
 * Report metadata and configuration
 */
export const reportConfig: Record<string, ReportConfigItem> = {
  usersByCountry: {
    name: 'Users by Country Report',
    description: 'Analyzes unique users segmented by geographic location',
    metrics: ['totalUsers', 'activeUsers', 'sessions', 'engagementRate'],
    dimensions: ['country', 'countryId'],
    defaultDays: 30,
    maxCountries: 100,
    requires: ['aws-credentials', 'google-analytics-secret'],
  },
};

/**
 * List all available reports with metadata
 *
 * @returns Array of report configurations
 * @example
 * import { listReports } from './src/reports/index.js';
 *
 * const availableReports = listReports();
 * console.log(availableReports);
 */
export function listReports(): ReportListing[] {
  return Object.keys(reportConfig).map((key) => ({
    id: key,
    ...reportConfig[key],
  }));
}

export default reports;
