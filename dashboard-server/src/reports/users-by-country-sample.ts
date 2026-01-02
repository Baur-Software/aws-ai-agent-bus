#!/usr/bin/env node

interface SampleCountryData {
  country: string;
  countryId: string;
  totalUsers: number;
  activeUsers: number;
  sessions: number;
  engagementRate: number;
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

/**
 * Generate a sample report of unique users by country for the last 30 days
 * This is a demonstration showing the expected format of the actual report
 */
function generateSampleUsersReport(): void {
  console.log('\n=== UNIQUE USERS BY COUNTRY - LAST 30 DAYS ===');
  console.log('(Sample Data - Replace with actual Google Analytics data)\n');

  // Sample data structure that would come from Google Analytics
  const sampleData: SampleCountryData[] = [
    {
      country: 'United States',
      countryId: 'US',
      totalUsers: 15420,
      activeUsers: 12830,
      sessions: 28950,
      engagementRate: 0.68,
    },
    {
      country: 'Canada',
      countryId: 'CA',
      totalUsers: 3240,
      activeUsers: 2890,
      sessions: 6120,
      engagementRate: 0.72,
    },
    {
      country: 'United Kingdom',
      countryId: 'GB',
      totalUsers: 2890,
      activeUsers: 2450,
      sessions: 5670,
      engagementRate: 0.65,
    },
    {
      country: 'Germany',
      countryId: 'DE',
      totalUsers: 2110,
      activeUsers: 1890,
      sessions: 4230,
      engagementRate: 0.71,
    },
    {
      country: 'Australia',
      countryId: 'AU',
      totalUsers: 1850,
      activeUsers: 1620,
      sessions: 3450,
      engagementRate: 0.69,
    },
    {
      country: 'France',
      countryId: 'FR',
      totalUsers: 1680,
      activeUsers: 1420,
      sessions: 3120,
      engagementRate: 0.63,
    },
    {
      country: 'Japan',
      countryId: 'JP',
      totalUsers: 1420,
      activeUsers: 1230,
      sessions: 2890,
      engagementRate: 0.66,
    },
    {
      country: 'Netherlands',
      countryId: 'NL',
      totalUsers: 980,
      activeUsers: 850,
      sessions: 1890,
      engagementRate: 0.74,
    },
    {
      country: 'Brazil',
      countryId: 'BR',
      totalUsers: 890,
      activeUsers: 750,
      sessions: 1670,
      engagementRate: 0.61,
    },
    {
      country: 'India',
      countryId: 'IN',
      totalUsers: 760,
      activeUsers: 620,
      sessions: 1450,
      engagementRate: 0.58,
    },
    {
      country: 'Sweden',
      countryId: 'SE',
      totalUsers: 650,
      activeUsers: 580,
      sessions: 1290,
      engagementRate: 0.77,
    },
    {
      country: 'Spain',
      countryId: 'ES',
      totalUsers: 590,
      activeUsers: 510,
      sessions: 1180,
      engagementRate: 0.64,
    },
    {
      country: 'Italy',
      countryId: 'IT',
      totalUsers: 520,
      activeUsers: 440,
      sessions: 1020,
      engagementRate: 0.62,
    },
    {
      country: 'Mexico',
      countryId: 'MX',
      totalUsers: 480,
      activeUsers: 390,
      sessions: 890,
      engagementRate: 0.59,
    },
    {
      country: 'Belgium',
      countryId: 'BE',
      totalUsers: 420,
      activeUsers: 370,
      sessions: 810,
      engagementRate: 0.73,
    },
  ];

  let totalUsers = 0;
  const reportTable: ReportTableRow[] = [];

  // Format and display the data
  sampleData.forEach((row, index) => {
    totalUsers += row.totalUsers;

    reportTable.push({
      Rank: index + 1,
      Country: row.country,
      'Country Code': row.countryId,
      'Total Users': row.totalUsers.toLocaleString(),
      'Active Users': row.activeUsers.toLocaleString(),
      Sessions: row.sessions.toLocaleString(),
      'Engagement Rate': `${(row.engagementRate * 100).toFixed(2)}%`,
    });
  });

  // Display table
  console.table(reportTable);

  console.log(`\nSummary:`);
  console.log(
    `• Total unique users across all countries: ${totalUsers.toLocaleString()}`
  );
  console.log(`• Countries represented: ${sampleData.length}`);
  console.log(
    `• Date range: Last 30 days (${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toDateString()} - ${new Date().toDateString()})`
  );
  console.log(`• Report generated: ${new Date().toISOString()}`);

  // Top 5 countries
  console.log(`\nTop 5 Countries by Users:`);
  sampleData.slice(0, 5).forEach((row, index) => {
    const percentage = ((row.totalUsers / totalUsers) * 100).toFixed(2);
    console.log(
      `${index + 1}. ${row.country}: ${row.totalUsers.toLocaleString()} users (${percentage}%)`
    );
  });

  // Geographic distribution insights
  console.log(`\nGeographic Insights:`);
  const northAmericaCodes = ['US', 'CA', 'MX'];
  const europeCodes = ['GB', 'DE', 'FR', 'NL', 'SE', 'ES', 'IT', 'BE'];
  const asiaPacificCodes = ['AU', 'JP', 'IN'];

  const northAmerica = sampleData
    .filter((c) => northAmericaCodes.includes(c.countryId))
    .reduce((sum, c) => sum + c.totalUsers, 0);
  const europe = sampleData
    .filter((c) => europeCodes.includes(c.countryId))
    .reduce((sum, c) => sum + c.totalUsers, 0);
  const asiaPacific = sampleData
    .filter((c) => asiaPacificCodes.includes(c.countryId))
    .reduce((sum, c) => sum + c.totalUsers, 0);
  const other = totalUsers - northAmerica - europe - asiaPacific;

  console.log(
    `• North America: ${northAmerica.toLocaleString()} users (${((northAmerica / totalUsers) * 100).toFixed(1)}%)`
  );
  console.log(
    `• Europe: ${europe.toLocaleString()} users (${((europe / totalUsers) * 100).toFixed(1)}%)`
  );
  console.log(
    `• Asia-Pacific: ${asiaPacific.toLocaleString()} users (${((asiaPacific / totalUsers) * 100).toFixed(1)}%)`
  );
  console.log(
    `• Other: ${other.toLocaleString()} users (${((other / totalUsers) * 100).toFixed(1)}%)`
  );

  console.log(`\nHighest Engagement Countries:`);
  const sortedByEngagement = [...sampleData].sort(
    (a, b) => b.engagementRate - a.engagementRate
  );
  sortedByEngagement.slice(0, 3).forEach((row, index) => {
    console.log(
      `${index + 1}. ${row.country}: ${(row.engagementRate * 100).toFixed(2)}% engagement rate`
    );
  });

  console.log(
    `\n📊 To generate the actual report with live Google Analytics data:`
  );
  console.log(
    `   1. Configure AWS credentials with access to the secrets manager`
  );
  console.log(
    `   2. Ensure the 'myproject-content-pipeline/google-analytics' secret exists`
  );
  console.log(`   3. Run: node generate-users-by-country-report.js`);
}

// Run the sample report
console.log('🌍 GOOGLE ANALYTICS - UNIQUE USERS BY COUNTRY REPORT');
generateSampleUsersReport();

export { generateSampleUsersReport };
