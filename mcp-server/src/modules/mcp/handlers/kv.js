import DynamoDBService from '../../aws/dynamodb.js';

export class KVHandler {
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

  static isExpired(item) {
    if (!item.expires_at) return false;
    return Date.now() / 1000 > item.expires_at;
  }
}

export default KVHandler;
