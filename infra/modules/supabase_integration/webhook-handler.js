const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const eventbridge = new EventBridgeClient({
  region: process.env.AWS_REGION || 'us-west-2'
});

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-west-2'
});

exports.handler = async (event) => {
  console.log('Received Supabase webhook:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');
    const headers = event.headers || {};

    // Extract database event information
    const { type, table, record, old_record, schema } = body;
    
    // Send event to EventBridge
    const eventDetail = {
      project_ref: process.env.PROJECT_REF,
      event_type: type,
      table_name: table,
      schema_name: schema,
      record: record,
      old_record: old_record,
      timestamp: new Date().toISOString()
    };

    const command = new PutEventsCommand({
      Entries: [{
        Source: 'agent-mesh.supabase',
        DetailType: 'Supabase Database Event',
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