#!/usr/bin/env node

import 'dotenv/config';
import { GoogleAnalyticsService } from '../services/google-analytics.js';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/**
 * Generate a report of unique users by country for the last 30 days
 */
async function generateUsersReport() {
  try {
    console.log('Initializing Google Analytics service...');
    
    // Use AWS region from environment or default to us-west-2
    const awsRegion = process.env.AWS_REGION || 'us-west-2';
    
    // Initialize AWS Secrets Manager with configured region
    const secretsClient = new SecretsManagerClient({ 
      region: awsRegion
    });
    
    console.log(`Using AWS region: ${awsRegion}`);
    
    // Get credentials from AWS Secrets Manager
    const command = new GetSecretValueCommand({
      SecretId: 'agent-mesh-mcp/google-analytics'
    });
    
    const response = await secretsClient.send(command);
    const credentials = JSON.parse(response.SecretString);
    
    // Initialize Google Analytics service
    const gaService = new GoogleAnalyticsService();
    await gaService.initialize(credentials);
    
    console.log('Fetching unique users by country report...');
    
    // Get property ID from credentials or use default
    const propertyId = credentials.property_id || '466716734';
    
    // Create report request for unique users by country
    const reportRequest = {
      dimensions: [
        { name: 'country' },
        { name: 'countryId' }
      ],
      metrics: [
        { name: 'totalUsers' },
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'engagementRate' }
      ],
      dateRanges: [{ 
        startDate: '30daysAgo', 
        endDate: 'today' 
      }],
      orderBys: [{ 
        metric: { metricName: 'totalUsers' }, 
        desc: true 
      }],
      limit: 100
    };
    
    // Run the report
    const reportData = await gaService.runReport(propertyId, reportRequest);
    
    console.log('\n=== UNIQUE USERS BY COUNTRY - LAST 30 DAYS ===\n');
    
    let totalUsers = 0;
    const reportTable = [];
    
    // Format and display the data
    reportData.forEach((row, index) => {
      const users = parseInt(row.totalUsers) || 0;
      totalUsers += users;
      
      reportTable.push({
        'Rank': index + 1,
        'Country': row.country || 'Unknown',
        'Country Code': row.countryId || 'N/A',
        'Total Users': users.toLocaleString(),
        'Active Users': parseInt(row.activeUsers || 0).toLocaleString(),
        'Sessions': parseInt(row.sessions || 0).toLocaleString(),
        'Engagement Rate': `${(parseFloat(row.engagementRate || 0) * 100).toFixed(2)}%`
      });
    });
    
    // Display table
    console.table(reportTable);
    
    console.log(`\nSummary:`);
    console.log(`• Total unique users across all countries: ${totalUsers.toLocaleString()}`);
    console.log(`• Countries represented: ${reportData.length}`);
    console.log(`• Date range: Last 30 days (${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toDateString()} - ${new Date().toDateString()})`);
    console.log(`• Report generated: ${new Date().toISOString()}`);
    
    // Top 5 countries
    console.log(`\nTop 5 Countries by Users:`);
    reportData.slice(0, 5).forEach((row, index) => {
      const percentage = ((parseInt(row.totalUsers) / totalUsers) * 100).toFixed(2);
      console.log(`${index + 1}. ${row.country}: ${parseInt(row.totalUsers).toLocaleString()} users (${percentage}%)`);
    });
    
  } catch (error) {
    console.error('Error generating users report:', error.message);
    process.exit(1);
  }
}

// Run the report if this script is executed directly
console.log('Starting users by country report...');
generateUsersReport().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});

export { generateUsersReport };