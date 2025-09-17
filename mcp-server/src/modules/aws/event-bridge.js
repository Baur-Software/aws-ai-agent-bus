import {
  EventBridgeClient,
  PutEventsCommand
} from '@aws-sdk/client-eventbridge';

const region = process.env.AWS_REGION || 'us-west-2';
const eventBridgeClient = new EventBridgeClient({ region });

export default {
  async putEvents(events) {
    const command = new PutEventsCommand({
      Entries: events
    });

    return await eventBridgeClient.send(command);
  }
};