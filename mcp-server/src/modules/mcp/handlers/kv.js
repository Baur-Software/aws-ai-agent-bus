import DynamoDBService from '../../aws/dynamodb.js';
import EventsHandler from './events.js';

/**
 * Handler for key-value storage operations using DynamoDB.
 * Provides TTL support and automatic expiration handling for cached data.
 *
 * @class KVHandler
 * @example
 * // Store a value with 24-hour TTL
 * await KVHandler.set({ key: 'user-prefs', value: '{"theme": "dark"}' });
 *
 * // Retrieve a value
 * const result = await KVHandler.get({ key: 'user-prefs' });
 * console.log(result.value); // '{"theme": "dark"}' or null if expired/not found
 */
export class KVHandler {
  /**
   * Retrieve a value from the key-value store.
   * Automatically handles expiration by checking TTL and returning null for expired items.
   * Gracefully handles missing infrastructure for multi-user agent bus scenarios.
   *
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.key - The key to retrieve (required)
   * @returns {Promise<Object>} Object containing the value (null if not found or expired)
   * @throws {Error} If key parameter is missing
   * @example
   * const result = await KVHandler.get({ key: 'session-data' });
   * if (result.value !== null) {
   *   console.log('Found value:', result.value);
   * } else {
   *   console.log('Key not found or expired');
   * }
   */
  static async get({ key }) {
    if (!key) {
      throw new Error('Key is required');
    }

    const result = await DynamoDBService.getItem(`KV#${key}`);

    // Handle table unavailable gracefully
    if (result.tableUnavailable) {
      console.warn(`KV get failed for key "${key}":`, result.warning);
      return {
        value: null,
        warning: result.warning
      };
    }

    const item = result.item;

    // Check if item exists and is not expired
    if (!item || this.isExpired(item)) {
      return { value: null };
    }

    // Publish get event
    try {
      await EventsHandler.send({
        detailType: 'KV.Get',
        detail: {
          key: key,
          found: true,
          size: item.value ? item.value.length : 0
        },
        source: 'mcp-server'
      });
    } catch (eventError) {
      console.warn('Failed to publish KV get event:', eventError);
      // Don't fail the operation if event publishing fails
    }

    return { value: item.value };
  }

  /**
   * Store a value in the key-value store with optional TTL.
   * Uses DynamoDB TTL for automatic expiration.
   * Gracefully handles missing infrastructure for multi-user agent bus scenarios.
   *
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.key - The key to store (required)
   * @param {any} params.value - The value to store (required)
   * @param {number} [params.ttl_hours=24] - Time to live in hours (default: 24)
   * @returns {Promise<Object>} Object indicating success
   * @throws {Error} If key or value parameters are missing
   * @example
   * await KVHandler.set({
   *   key: 'user-session',
   *   value: '{"userId": 123}',
   *   ttl_hours: 2
   * });
   */
  static async set({ key, value, ttl_hours = 24 }) {
    if (!key || value === undefined || value === null) {
      throw new Error('Key and value are required');
    }

    // Calculate expiration timestamp
    const expiresAt = Math.floor(Date.now() / 1000) + (ttl_hours * 3600);

    const item = {
      key: `KV#${key}`,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      expires_at: expiresAt,
      created_at: Math.floor(Date.now() / 1000)
    };

    const result = await DynamoDBService.putItem(item);

    // Handle table unavailable gracefully
    if (result.tableUnavailable) {
      console.warn(`KV set failed for key "${key}":`, result.warning);
      return {
        success: false,
        warning: result.warning
      };
    }

    // Publish set event
    try {
      await EventsHandler.send({
        detailType: 'KV.Set',
        detail: {
          key: key,
          size: item.value ? item.value.length : 0,
          ttl_hours: ttl_hours
        },
        source: 'mcp-server'
      });
    } catch (eventError) {
      console.warn('Failed to publish KV set event:', eventError);
      // Don't fail the operation if event publishing fails
    }

    return { success: true };
  }

  /**
   * Check if an item has expired based on its TTL.
   *
   * @static
   * @param {Object} item - The item to check
   * @returns {boolean} True if the item has expired
   */
  static isExpired(item) {
    if (!item || !item.expires_at) {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return item.expires_at < now;
  }
}

export default KVHandler;