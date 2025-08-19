const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const eventbridge = new EventBridgeClient({
  region: process.env.AWS_REGION || 'us-west-2'
});

exports.handler = async (event) => {
  console.log('Received Vercel webhook:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');
    const headers = event.headers || {};

    // Validate Vercel signature if present
    const signature = headers['x-vercel-signature'];
    if (signature) {
      // In production, you should verify the signature
      console.log('Vercel signature received:', signature);
    }

    // Extract deployment information
    const deployment = body.deployment || {};
    const project = body.project || {};
    
    // Send event to EventBridge
    const eventDetail = {
      deployment_id: deployment.id,
      deployment_url: deployment.url,
      project_id: project.id || process.env.PROJECT_ID,
      project_name: project.name,
      state: deployment.state,
      created_at: deployment.createdAt,
      ready: deployment.ready,
      type: deployment.type,
      source: deployment.source
    };

    const command = new PutEventsCommand({
      Entries: [{
        Source: 'agent-mesh.vercel',
        DetailType: 'Vercel Deployment',
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