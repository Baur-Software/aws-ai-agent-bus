const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const crypto = require('crypto');

const eventbridge = new EventBridgeClient({
  region: process.env.AWS_REGION || 'us-west-2'
});

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-west-2'
});

// Cache for webhook secret
let cachedWebhookSecret = null;

async function getWebhookSecret() {
  if (cachedWebhookSecret) {
    return cachedWebhookSecret;
  }
  
  try {
    const response = await secretsManager.send(new GetSecretValueCommand({
      SecretId: process.env.WEBHOOK_SECRET_ARN
    }));
    cachedWebhookSecret = response.SecretString;
    return cachedWebhookSecret;
  } catch (error) {
    console.error('Error retrieving webhook secret:', error);
    throw error;
  }
}

function verifyStripeSignature(payload, signature, secret) {
  const elements = signature.split(',');
  const signatureElements = {};
  
  for (const element of elements) {
    const [key, value] = element.split('=');
    signatureElements[key] = value;
  }
  
  if (!signatureElements.t || !signatureElements.v1) {
    return false;
  }
  
  const timestamp = signatureElements.t;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
    
  return signatureElements.v1 === expectedSignature;
}

exports.handler = async (event) => {
  console.log('Received Stripe webhook:', JSON.stringify(event, null, 2));

  try {
    const body = event.body;
    const headers = event.headers || {};
    
    // Get Stripe signature
    const stripeSignature = headers['stripe-signature'];
    if (!stripeSignature) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing Stripe signature' })
      };
    }
    
    // Verify webhook signature
    const webhookSecret = await getWebhookSecret();
    const isValidSignature = verifyStripeSignature(body, stripeSignature, webhookSecret);
    
    if (!isValidSignature) {
      console.error('Invalid Stripe signature');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }
    
    // Parse webhook payload
    const webhookData = JSON.parse(body);
    const { type, data, created, id } = webhookData;
    
    // Determine event type category
    let eventCategory = 'Stripe Payment Event';
    if (type.startsWith('customer.subscription.')) {
      eventCategory = 'Stripe Subscription Event';
    } else if (type.startsWith('customer.')) {
      eventCategory = 'Stripe Customer Event';
    }
    
    // Send event to EventBridge
    const eventDetail = {
      stripe_event_id: id,
      stripe_event_type: type,
      created_timestamp: created,
      data: data,
      timestamp: new Date().toISOString()
    };

    const command = new PutEventsCommand({
      Entries: [{
        Source: 'agent-mesh.stripe',
        DetailType: eventCategory,
        Detail: JSON.stringify(eventDetail),
        EventBusName: '${event_bus_name}'
      }]
    });

    const response = await eventbridge.send(command);
    console.log('Event sent to EventBridge:', response);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Webhook processed successfully',
        stripe_event_id: id,
        event_id: response.Entries?.[0]?.EventId
      })
    };

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to process webhook',
        message: error.message
      })
    };
  }
};