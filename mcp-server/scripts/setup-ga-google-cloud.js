#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import readline from 'readline';
import http from 'http';
import url from 'url';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { SecretsManagerClient, CreateSecretCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import 'dotenv/config';

// Only create readline interface if not in test mode
let rl;
if (!process.argv.includes('--test')) {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createGoogleCloudProject() {
  console.log('\n🌟 GOOGLE CLOUD SETUP GUIDE');
  console.log('=====================================\n');
  
  console.log('Google Cloud Console does not provide APIs for automated OAuth2 client creation.');
  console.log('You will need to complete these steps manually:\n');

  console.log('1️⃣  CREATE OR SELECT PROJECT');
  console.log('   • Go to: https://console.cloud.google.com/');
  console.log('   • Create a new project or select existing one');
  console.log('   • Note your Project ID for later\n');

  console.log('2️⃣  ENABLE GOOGLE ANALYTICS API');
  console.log('   • Go to: https://console.cloud.google.com/apis/library');
  console.log('   • Search for "Google Analytics Reporting API"');
  console.log('   • Click "Enable"\n');

  console.log('3️⃣  CREATE OAuth2 CREDENTIALS');
  console.log('   • Go to: https://console.cloud.google.com/apis/credentials');
  console.log('   • Click "Create Credentials" → "OAuth client ID"');
  console.log('   • Choose "Web application"');
  console.log('   • Add authorized redirect URIs:');
  console.log('     - http://localhost:3000/auth/callback');
  console.log('     - https://developers.google.com/oauthplayground');
  console.log('   • Download the JSON file\n');

  console.log('4️⃣  CONFIGURE OAuth CONSENT SCREEN');
  console.log('   • Go to: https://console.cloud.google.com/apis/credentials/consent');
  console.log('   • Choose "External" user type');
  console.log('   • Fill out required fields (App name, User support email)');
  console.log('   • Add your email to Test users\n');

  // Only wait for user input if not in test mode
  if (!process.argv.includes('--test')) {
    await question('Press Enter when you have completed all steps above...');
  }
}

async function processCredentialFile() {
  console.log('\n📁 CREDENTIAL FILE PROCESSING');
  console.log('===============================\n');

  const downloadPath = process.env.USERPROFILE ? 
    join(process.env.USERPROFILE, 'Downloads') : 
    join(process.env.HOME || '/tmp', 'Downloads');

  console.log(`Looking for credential files in: ${downloadPath}\n`);

  let credentialFile = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (!credentialFile && attempts < maxAttempts) {
    const filePath = await question('Enter the full path to your downloaded client_secret_*.json file: ');
    
    if (existsSync(filePath)) {
      try {
        const content = JSON.parse(readFileSync(filePath, 'utf8'));
        if (content.web && content.web.client_id && content.web.client_secret) {
          credentialFile = content.web;
          console.log('✅ Valid OAuth2 credential file found!\n');
        } else {
          console.log('❌ This doesn\'t look like a valid OAuth2 client credential file.\n');
        }
      } catch (error) {
        console.log(`❌ Error reading file: ${error.message}\n`);
      }
    } else {
      console.log('❌ File not found. Please check the path.\n');
    }
    
    attempts++;
    if (!credentialFile && attempts < maxAttempts) {
      console.log(`Attempt ${attempts}/${maxAttempts} failed. Please try again.\n`);
    }
  }

  if (!credentialFile) {
    throw new Error('Could not process credential file after 3 attempts');
  }

  return credentialFile;
}

async function testGoogleAnalyticsAccess(credentials) {
  console.log('🧪 TESTING GOOGLE ANALYTICS ACCESS');
  console.log('===================================\n');

  const propertyId = await question('Enter your Google Analytics 4 Property ID (format: 123456789): ');
  
  if (!/^\d+$/.test(propertyId)) {
    throw new Error('Property ID must be numeric');
  }

  console.log('Setting up OAuth2 client...');
  
  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    'http://localhost:3000/auth/callback'
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly'
    ],
    prompt: 'consent'
  });

  console.log('\n🔗 Please visit this URL to authorize the application:');
  console.log(`${authUrl}\n`);

  // Start local server to handle OAuth callback
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const queryObject = url.parse(req.url, true).query;
      
      if (queryObject.code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>✅ Authorization Successful!</h2>
              <p>You can close this window and return to the terminal.</p>
              <script>window.close();</script>
            </body>
          </html>
        `);
        server.close();
        resolve(queryObject.code);
      } else if (queryObject.error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>❌ Authorization Failed</h2>
              <p>Error: ${queryObject.error}</p>
              <p>Please check the terminal for next steps.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(`OAuth authorization failed: ${queryObject.error}`));
      }
    });

    server.listen(3000, () => {
      console.log('🌐 Local server started on http://localhost:3000');
      console.log('Waiting for authorization callback...');
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth authorization timeout - please try again'));
    }, 300000);
  });

  console.log('Exchanging authorization code for tokens...');
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  console.log('Testing Google Analytics API access...');
  const analytics = google.analyticsdata('v1beta');
  
  try {
    const response = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }],
        dimensions: [{ name: 'country' }]
      },
      auth: oauth2Client
    });

    if (response.data && response.data.rows) {
      console.log('✅ Google Analytics API test successful!');
      console.log(`📊 Found data for ${response.data.rows.length} countries\n`);
    } else {
      console.log('⚠️  API call succeeded but no data returned. This might be normal for new properties.\n');
    }
  } catch (error) {
    throw new Error(`Google Analytics API test failed: ${error.message}`);
  }

  return {
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    property_id: propertyId
  };
}

async function saveCredentialsToAWS(credentials) {
  console.log('💾 SAVING TO AWS SECRETS MANAGER');
  console.log('==================================\n');
  
  try {
    // Configure AWS SDK with proper credentials
    const awsConfig = {
      region: process.env.AWS_REGION || 'us-west-2'
    };
    
    // Use AWS profile if available
    if (process.env.AWS_PROFILE) {
      console.log(`Using AWS profile: ${process.env.AWS_PROFILE}`);
    }
    
    const secretsClient = new SecretsManagerClient(awsConfig);
    
    const secretName = 'agent-mesh-mcp/google-analytics';
    const secretValue = JSON.stringify({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      property_id: credentials.property_id
    });

    console.log(`Saving credentials to AWS secret: ${secretName}`);
    
    try {
      // Try to create the secret
      await secretsClient.send(new CreateSecretCommand({
        Name: secretName,
        Description: 'Google Analytics API credentials for AWS AI Agent Bus',
        SecretString: secretValue
      }));
      
      console.log('✅ Credentials created successfully in AWS Secrets Manager!');
    } catch (error) {
      if (error.name === 'ResourceExistsException') {
        // Secret exists, update it
        console.log('Secret already exists, updating...');
        await secretsClient.send(new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: secretValue
        }));
        console.log('✅ Credentials updated successfully in AWS Secrets Manager!');
      } else {
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to save credentials to AWS: ${error.message}`);
    console.error('You can save manually using:');
    console.log(JSON.stringify({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      property_id: credentials.property_id
    }, null, 2));
    return false;
  }
}

async function generateFinalInstructions(credentials, savedToAWS) {
  console.log('\n🎉 SETUP COMPLETE');
  console.log('==================\n');
  
  if (savedToAWS) {
    console.log('✅ Your Google Analytics integration is fully configured!');
    console.log('✅ Credentials saved to AWS Secrets Manager');
    console.log('✅ No additional setup required!');
    console.log('\n🚀 Ready to use immediately! Try running:');
    console.log('   npm run report:users-by-country\n');
  } else {
    console.log('⚠️  Google Analytics OAuth completed, but AWS save failed.');
    console.log('✅ You can still use the integration - credentials are validated and working.');
    console.log('\n🔧 To manually save to AWS, use the credentials shown above with:');
    console.log('   npm run setup:ga-credentials (option 1)\n');
  }
  
  console.log('🔍 Test your setup with:');
  console.log('   npm run report:users-by-country-sample  # Sample data');
  console.log('   npm run report:users-by-country        # Live data\n');
}

async function main() {
  try {
    console.log('🚀 Google Analytics + Google Cloud Setup Assistant');
    console.log('This tool will guide you through the complete setup process.\n');
    
    // Check if this is a test run
    if (process.argv.includes('--test')) {
      console.log('🧪 TEST MODE: Displaying instructions only (no interactive input)\n');
      await createGoogleCloudProject();
      console.log('\n✅ Test completed successfully!');
      console.log('Run without --test flag for full interactive setup.');
      return;
    }
    
    // Check if this is a debug run
    if (process.argv.includes('--debug')) {
      console.log('DEBUG: Running in debug mode');
      console.log('DEBUG: Process arguments:', process.argv);
      console.log('DEBUG: Current working directory:', process.cwd());
    }

    await createGoogleCloudProject();
    const credentials = await processCredentialFile();
    const finalCredentials = await testGoogleAnalyticsAccess(credentials);
    const savedToAWS = await saveCredentialsToAWS(finalCredentials);
    await generateFinalInstructions(finalCredentials, savedToAWS);

  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    console.error('\nFor help, check the documentation or create an issue:');
    console.error('https://github.com/Baur-Software/aws-ai-agent-bus/issues\n');
    process.exit(1);
  } finally {
    if (rl) {
      rl.close();
    }
  }
}

// Run the main function when script is executed directly
if (process.argv[1] && process.argv[1].endsWith('setup-ga-google-cloud.js')) {
  main();
}