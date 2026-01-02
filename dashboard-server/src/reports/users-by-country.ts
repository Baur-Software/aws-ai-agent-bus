#!/usr/bin/env node

import 'dotenv/config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// TODO: GoogleAnalyticsService doesn't exist in dashboard-server/src/services/
// This import path is broken - the service needs to be created or relocated
// For now, defining a minimal interface to satisfy TypeScript
interface GoogleAnalyticsCredentials {
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  property_id?: string;
}

interface ReportRequest {
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dateRanges: Array<{ startDate: string; endDate: string }>;
  orderBys?: Array<{ metric: { metricName: string }; desc: boolean }>;
  limit?: number;
}

interface ReportRow {
  country?: string;
  countryId?: string;
  totalUsers?: string;
  activeUsers?: string;
  sessions?: string;
  engagementRate?: string;
}

interface ReportTableRow {
  Rank: number;
  Country: string;
  'Country Code': string;
  'Total Users': string;
  'Active Users': string;
  Sessions: string;
  'Engagement Rate': string;
}

// Placeholder interface - actual implementation needed
interface GoogleAnalyticsServiceInterface {
  initialize(credentials: GoogleAnalyticsCredentials): Promise<void>;
  runReport(propertyId: string, request: ReportRequest): Promise<ReportRow[]>;
}

// TODO: Import actual GoogleAnalyticsService when it exists
// import { GoogleAnalyticsService } from '../services/google-analytics.js';
const GoogleAnalyticsService: new () => GoogleAnalyticsServiceInterface =
  class {
    async initialize(
      _credentials: GoogleAnalyticsCredentials
    ): Promise<void> {
      throw new Error(
        'GoogleAnalyticsService is not implemented. Create dashboard-server/src/services/google-analytics.ts'
      );
    }
    async runReport(
      _propertyId: string,
      _request: ReportRequest
    ): Promise<ReportRow[]> {
      throw new Error(
        'GoogleAnalyticsService is not implemented. Create dashboard-server/src/services/google-analytics.ts'
      );
    }
  };

/**
 * Generate a report of unique users by country for the last 30 days
 */
async function generateUsersReport(): Promise<void> {
  try {
    console.log('Initializing Google Analytics service...');

    // Use AWS region from environment or default to us-west-2
    const awsRegion = process.env.AWS_REGION || 'us-west-2';

    // Initialize AWS Secrets Manager with configured region
    const secretsClient = new SecretsManagerClient({
      region: awsRegion,
    });

    console.log(`Using AWS region: ${awsRegion}`);

    // Get credentials from AWS Secrets Manager
    const command = new GetSecretValueCommand({
      SecretId: 'agent-mesh-mcp/google-analytics',
    });

    const response = await secretsClient.send(command);
    const credentials = JSON.parse(
      response.SecretString || '{}'
    ) as GoogleAnalyticsCredentials;

    // Initialize Google Analytics service
    const gaService = new GoogleAnalyticsService();
    await gaService.initialize(credentials);

    console.log('Fetching unique users by country report...');

    // Get property ID from credentials or use default
    const propertyId = credentials.property_id || '466716734';

    // Create report request for unique users by country
    const reportRequest: ReportRequest = {
      dimensions: [{ name: 'country' }, { name: 'countryId' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'engagementRate' },
      ],
      dateRanges: [
        {
          startDate: '30daysAgo',
          endDate: 'today',
        },
      ],
      orderBys: [
        {
          metric: { metricName: 'totalUsers' },
          desc: true,
        },
      ],
      limit: 100,
    };

    // Run the report
    const reportData = await gaService.runReport(propertyId, reportRequest);

    console.log('\n=== UNIQUE USERS BY COUNTRY - LAST 30 DAYS ===\n');

    let totalUsers = 0;
    const reportTable: ReportTableRow[] = [];

    // Format and display the data
    reportData.forEach((row, index) => {
      const users = parseInt(row.totalUsers || '0', 10) || 0;
      totalUsers += users;

      reportTable.push({
        Rank: index + 1,
        Country: row.country || 'Unknown',
        'Country Code': row.countryId || 'N/A',
        'Total Users': users.toLocaleString(),
        'Active Users': parseInt(row.activeUsers || '0', 10).toLocaleString(),
        Sessions: parseInt(row.sessions || '0', 10).toLocaleString(),
        'Engagement Rate': `${(parseFloat(row.engagementRate || '0') * 100).toFixed(2)}%`,
      });
    });

    // Display table
    console.table(reportTable);

    console.log(`\nSummary:`);
    console.log(
      `• Total unique users across all countries: ${totalUsers.toLocaleString()}`
    );
    console.log(`• Countries represented: ${reportData.length}`);
    console.log(
      `• Date range: Last 30 days (${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toDateString()} - ${new Date().toDateString()})`
    );
    console.log(`• Report generated: ${new Date().toISOString()}`);

    // Top 5 countries
    console.log(`\nTop 5 Countries by Users:`);
    reportData.slice(0, 5).forEach((row, index) => {
      const percentage = (
        (parseInt(row.totalUsers || '0', 10) / totalUsers) *
        100
      ).toFixed(2);
      console.log(
        `${index + 1}. ${row.country}: ${parseInt(row.totalUsers || '0', 10).toLocaleString()} users (${percentage}%)`
      );
    });
  } catch (error) {
    console.error(
      'Error generating users report:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

// Run the report if this script is executed directly
console.log('Starting users by country report...');
generateUsersReport().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

export { generateUsersReport };
