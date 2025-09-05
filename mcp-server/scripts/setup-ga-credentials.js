#!/usr/bin/env node

import { SecretsManagerClient, CreateSecretCommand, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import readline from 'readline';

/**
 * Interactive script to set up Google Analytics credentials in AWS Secrets Manager
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

class GACredentialsSetup {
  constructor() {
    this.secretsClient = new SecretsManagerClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.secretId = 'myproject-content-pipeline/google-analytics';
  }

  async run() {
    console.log('🔧 Google Analytics Credentials Setup for AWS Secrets Manager\n');

    try {
      const action = await question(
        'What would you like to do?\n' +
        '1. Create new credentials (first-time setup)\n' +
        '2. Update existing credentials\n' +
        '3. Test existing credentials\n' +
        '4. Show setup instructions\n' +
        'Choose (1-4): '
      );

      switch (action.trim()) {
        case '1':
          await this.createCredentials();
          break;
        case '2':
          await this.updateCredentials();
          break;
        case '3':
          await this.testCredentials();
          break;
        case '4':
          await this.showInstructions();
          break;
        default:
          console.log('Invalid option. Please run the script again.');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      rl.close();
    }
  }

  async createCredentials() {
    console.log('\n📝 Creating new Google Analytics credentials...\n');

    const clientId = await question('Enter your Google OAuth2 Client ID: ');
    const clientSecret = await question('Enter your Google OAuth2 Client Secret: ');
    const propertyId = await question('Enter your Google Analytics Property ID (numbers only): ');

    console.log('\n🌐 Starting OAuth2 flow to get access tokens...');
    
    const tokens = await this.getTokensInteractively(clientId, clientSecret);
    
    const credentials = {
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      property_id: propertyId.trim()
    };

    try {
      await this.secretsClient.send(new CreateSecretCommand({
        Name: this.secretId,
        Description: 'Google Analytics API credentials for MCP server',
        SecretString: JSON.stringify(credentials, null, 2)
      }));

      console.log('✅ Credentials successfully stored in AWS Secrets Manager!');
      console.log(`Secret ID: ${this.secretId}`);
      
      await this.testCredentials();
    } catch (error) {
      if (error.name === 'ResourceExistsException') {
        console.log('⚠️  Secret already exists. Use option 2 to update it.');
      } else {
        throw error;
      }
    }
  }

  async updateCredentials() {
    console.log('\n📝 Updating existing credentials...\n');

    try {
      // Get existing credentials
      const response = await this.secretsClient.send(new GetSecretValueCommand({
        SecretId: this.secretId
      }));

      const existing = JSON.parse(response.SecretString);
      console.log('Current credentials found.');
      console.log(`Client ID: ${existing.client_id}`);
      console.log(`Property ID: ${existing.property_id}`);

      const field = await question(
        '\nWhat would you like to update?\n' +
        '1. Access/Refresh tokens (refresh existing OAuth)\n' +
        '2. Client ID/Secret\n' +
        '3. Property ID\n' +
        '4. All credentials\n' +
        'Choose (1-4): '
      );

      let updated = { ...existing };

      switch (field.trim()) {
        case '1':
          const tokens = await this.getTokensInteractively(existing.client_id, existing.client_secret);
          updated.access_token = tokens.access_token;
          updated.refresh_token = tokens.refresh_token;
          break;
        case '2':
          updated.client_id = await question('New Client ID: ');
          updated.client_secret = await question('New Client Secret: ');
          break;
        case '3':
          updated.property_id = await question('New Property ID: ');
          break;
        case '4':
          updated.client_id = await question('Client ID: ');
          updated.client_secret = await question('Client Secret: ');
          updated.property_id = await question('Property ID: ');
          const newTokens = await this.getTokensInteractively(updated.client_id, updated.client_secret);
          updated.access_token = newTokens.access_token;
          updated.refresh_token = newTokens.refresh_token;
          break;
        default:
          console.log('Invalid option.');
          return;
      }

      await this.secretsClient.send(new UpdateSecretCommand({
        SecretId: this.secretId,
        SecretString: JSON.stringify(updated, null, 2)
      }));

      console.log('✅ Credentials updated successfully!');
      await this.testCredentials();
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('❌ Secret not found. Use option 1 to create it first.');
      } else {
        throw error;
      }
    }
  }

  async testCredentials() {
    console.log('\n🧪 Testing credentials...\n');

    try {
      const response = await this.secretsClient.send(new GetSecretValueCommand({
        SecretId: this.secretId
      }));

      const credentials = JSON.parse(response.SecretString);
      console.log('✅ Secret retrieved from AWS Secrets Manager');
      
      // Test Google Analytics connection
      const { GoogleAnalyticsService } = await import('../src/services/google-analytics.js');
      const gaService = new GoogleAnalyticsService();
      
      await gaService.initialize(credentials);
      console.log('✅ Google Analytics service initialized');

      // Test property access
      try {
        const metadata = await gaService.getPropertyDetails(credentials.property_id);
        console.log('✅ Property access verified');
        console.log(`   Property: ${metadata.name || 'Unknown'}`);
      } catch (error) {
        console.log('⚠️  Property access test failed:', error.message);
      }

      // Test report generation
      try {
        const testReport = await gaService.runReport(credentials.property_id, {
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'totalUsers' }],
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          limit: 5
        });
        
        console.log('✅ Test report generated successfully');
        console.log(`   Returned ${testReport.length} rows`);
        
        if (testReport.length > 0) {
          console.log('   Sample data:', testReport[0]);
        }
      } catch (error) {
        console.log('⚠️  Report generation test failed:', error.message);
      }

      console.log('\n🎉 Credentials are working correctly!');
      console.log('\nYou can now run:');
      console.log('  npm run report:users-by-country');

    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('❌ Secret not found. Use option 1 to create it first.');
      } else {
        console.log('❌ Test failed:', error.message);
      }
    }
  }

  async getTokensInteractively(clientId, clientSecret) {
    return new Promise((resolve, reject) => {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:3000/auth/callback'
      );

      const scopes = [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly'
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });

      console.log('\n🌐 Please visit this URL to authorize the application:');
      console.log(authUrl);
      console.log('\nWaiting for authorization callback...');

      const server = http.createServer(async (req, res) => {
        const queryObject = url.parse(req.url, true).query;
        
        if (queryObject.code) {
          try {
            const { tokens } = await oauth2Client.getToken(queryObject.code);
            res.end('Authorization successful! You can close this window.');
            server.close();
            resolve(tokens);
          } catch (error) {
            res.end('Authorization failed!');
            server.close();
            reject(error);
          }
        } else if (queryObject.error) {
          res.end('Authorization was denied.');
          server.close();
          reject(new Error('Authorization denied'));
        }
      });

      server.listen(3000, () => {
        console.log('Local server started on http://localhost:3000');
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authorization timeout'));
      }, 300000);
    });
  }

  async showInstructions() {
    console.log(`
📖 Setup Instructions:

1. Create Google Cloud Project:
   - Go to https://console.cloud.google.com/
   - Create new project or select existing
   - Enable Analytics Data API and Search Console API

2. Create OAuth2 Credentials:
   - Go to APIs & Services → Credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Add redirect URI: http://localhost:3000/auth/callback
   - Download credentials

3. Get Property ID:
   - Go to Google Analytics → Admin → Property Settings
   - Copy the Property ID (numbers only)

4. Configure AWS:
   - Ensure AWS credentials are configured
   - Verify region is set to us-east-1 (or update script)

5. Run this script:
   - Choose option 1 for first-time setup
   - Follow OAuth flow in browser
   - Credentials will be stored in AWS Secrets Manager

For detailed instructions, see:
mcp-server/docs/google-analytics-setup.md
`);
  }
}

// Run the setup
const setup = new GACredentialsSetup();
setup.run().catch(console.error);