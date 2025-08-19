import { PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { eventBridge } from './clients.js';

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'agent-mesh-dev';

export class EventBridgeService {
  static async sendEvent(detailType, detail, source = 'mcp-server') {
    const command = new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: source,
          DetailType: detailType,
          Detail: JSON.stringify(detail),
          Time: new Date(),
        },
      ],
    });
    
    const response = await eventBridge.send(command);
    return {
      eventId: response.Entries?.[0]?.EventId,
      success: response.FailedEntryCount === 0,
    };
  }
}

export default EventBridgeService;
