import DynamoDBService from '../../aws/dynamodb.js';

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

    const item = await DynamoDBService.getItem({ key: `KV#${key}` });
    
    if (!item || this.isExpired(item)) {
      return { value: null };
    }

    return { value: item.value };
  }

  /**
   * Store a value in the key-value store with TTL support.
   * Values are automatically expired based on the TTL setting.
   * 
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.key - The key to store (required)
   * @param {*} params.value - The value to store (required, can be any type)
   * @param {number} [params.ttl_hours=24] - Time to live in hours (default: 24)
   * @returns {Promise<Object>} Object with success flag
   * @throws {Error} If key or value parameters are missing
   * @example
   * // Store with default 24-hour TTL
   * await KVHandler.set({ key: 'cache-key', value: 'cached-data' });
   * 
   * // Store with custom 1-hour TTL
   * await KVHandler.set({ 
   *   key: 'session-token', 
   *   value: 'abc123', 
   *   ttl_hours: 1 
   * });
   */
  static async set({ key, value, ttl_hours = 24 }) {
    if (!key || value === undefined) {
      throw new Error('Key and value are required');
    }

    const ttl = Math.floor(Date.now() / 1000) + (ttl_hours * 3600);
    
    await DynamoDBService.putItem({
      key: `KV#${key}`,
      value,
      expires_at: ttl,
      type: 'kv',
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Check if a DynamoDB item has expired based on its TTL.
   * Used internally to validate item freshness before returning values.
   * 
   * @static
   * @private
   * @param {Object} item - DynamoDB item with expires_at field
   * @param {number} [item.expires_at] - Unix timestamp for expiration
   * @returns {boolean} True if item is expired, false otherwise
   * @example
   * const item = { expires_at: 1693420800 }; // Some past timestamp
   * const expired = KVHandler.isExpired(item); // true
   */
  static isExpired(item) {
    if (!item.expires_at) return false;
    return Date.now() / 1000 > item.expires_at;
  }
}

export default KVHandler;
