import EventBridgeService from '../../aws/event-bridge.js';

export class EventsHandler {
  static async send({ detailType, detail, source = 'mcp-client' } = {}) {
    if (!detailType || !detail) {
      throw new Error('detailType and detail are required');
    }

    const { eventId, success } = await EventBridgeService.sendEvent(
      detailType,
      detail,
      source
    );

    if (!success) {
      throw new Error('Failed to send event');
    }

    return {
      eventId,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  static async sendBatch(events = []) {
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Events array is required and cannot be empty');
    }

    const results = await Promise.allSettled(
      events.map(event => this.send(event))
    );

    return {
      success: results.every(r => r.status === 'fulfilled' && r.value.success),
      results: results.map((result, index) => ({
        event: events[index],
        success: result.status === 'fulfilled',
        ...(result.status === 'fulfilled' 
          ? { eventId: result.value.eventId }
          : { error: result.reason.message }
        ),
      })),
    };
  }
}

export default EventsHandler;
