/**
 * Simple events handler for dashboard-server
 * Provides basic event logging functionality
 */

export class EventsHandler {
  static async send({ detailType, detail, source = 'dashboard-server' }: { detailType?: string; detail?: any; source?: string } = {}) {
    if (!detailType || !detail) {
      throw new Error('detailType and detail are required');
    }

    // For now, just log the event since we don't have EventBridge set up
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    console.log('Event sent:', {
      eventId,
      detailType,
      detail,
      source,
      timestamp
    });

    return {
      eventId,
      success: true,
      timestamp,
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
          : { error: result.reason?.message || String(result.reason) }
        ),
      })),
    };
  }
}

export default EventsHandler;