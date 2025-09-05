# Google Analytics Reports

This directory contains pre-built report scripts that utilize the Google Analytics service to generate various analytics insights.

## Available Reports

### Users by Country Report

**File**: `users-by-country.js`  
**Sample**: `users-by-country-sample.js`

Generates a comprehensive report of unique users segmented by country for the last 30 days.

#### Features:
- **Total Users**: Unique users count by country
- **Active Users**: Engaged users within the period  
- **Sessions**: Total session count per country
- **Engagement Rate**: User engagement percentage
- **Geographic Insights**: Regional distribution analysis
- **Top Performers**: Highest traffic and engagement countries

#### Usage:

```bash
# From project root
cd mcp-server
node src/reports/users-by-country.js

# Or with npm script (if added)
npm run report:users-by-country
```

#### Prerequisites:

1. **AWS Credentials**: Must be configured with access to AWS Secrets Manager
2. **Google Analytics Secret**: Secret named `myproject-content-pipeline/google-analytics` must exist in AWS Secrets Manager
3. **Secret Format**:
   ```json
   {
     "client_id": "your-oauth-client-id",
     "client_secret": "your-oauth-secret", 
     "access_token": "your-access-token",
     "refresh_token": "your-refresh-token",
     "property_id": "your-ga4-property-id"
   }
   ```

#### Sample Output:

```
=== UNIQUE USERS BY COUNTRY - LAST 30 DAYS ===

┌─────────┬──────┬──────────────────┬──────────────┬─────────────┬──────────────┬──────────┬─────────────────┐
│ (index) │ Rank │ Country          │ Country Code │ Total Users │ Active Users │ Sessions │ Engagement Rate │
├─────────┼──────┼──────────────────┼──────────────┼─────────────┼──────────────┼──────────┼─────────────────┤
│ 0       │ 1    │ 'United States'  │ 'US'         │ '15,420'    │ '12,830'     │ '28,950' │ '68.00%'        │
│ 1       │ 2    │ 'Canada'         │ 'CA'         │ '3,240'     │ '2,890'      │ '6,120'  │ '72.00%'        │
└─────────┴──────┴──────────────────┴──────────────┴─────────────┴──────────────┴──────────┴─────────────────┘

Summary:
• Total unique users across all countries: 33,900
• Countries represented: 15
• Date range: Last 30 days
• Geographic distribution analysis
• Top performing countries by engagement
```

#### Troubleshooting:

**Error**: `Could not load credentials from any providers`
- **Solution**: Configure AWS credentials using AWS CLI, environment variables, or IAM roles
- **Check**: Verify AWS credentials with `aws sts get-caller-identity`

**Error**: `Failed to initialize Google Analytics`  
- **Solution**: Verify the secret exists and contains valid Google OAuth credentials
- **Check**: Test secret access with `aws secretsmanager get-secret-value --secret-id myproject-content-pipeline/google-analytics`

#### Development:

To create new reports:

1. Follow the same structure as `users-by-country.js`
2. Import the `GoogleAnalyticsService` from `../services/google-analytics.js`
3. Use the service's `runReport()` method with custom dimensions/metrics
4. Add comprehensive error handling and logging
5. Include sample data version for testing

#### Integration with MCP:

These reports can be integrated into the MCP server as tools by:

1. Adding handler methods to `../modules/mcp/handlers/google-analytics.js`
2. Registering new tools in the MCP server configuration
3. Following the existing pattern for GA integrations

## Architecture

Reports follow the clean architecture pattern:

```
reports/
├── README.md                    # This documentation
├── users-by-country.js         # Production report script
├── users-by-country-sample.js  # Sample data demonstration
└── [future-report].js          # Additional reports
```

Each report:
- Uses the centralized `GoogleAnalyticsService`
- Handles AWS authentication consistently
- Provides comprehensive error handling
- Includes sample data for testing
- Follows project coding standards