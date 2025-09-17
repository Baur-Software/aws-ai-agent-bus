import { GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, CreateTableCommand, DescribeTableCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { dynamodb } from './clients.js';

const TABLE_NAME = process.env.AGENT_MESH_KV_TABLE || process.env.DYNAMODB_TABLE || 'agent-mesh-dev-kv';

export class DynamoDBService {
  constructor() {
    this.client = dynamodb;
  }

  /**
   * Ensures the KV table exists, creating it if the user has permissions.
   * This enables seamless operation for multi-user agent bus scenarios.
   *
   * @static
   * @async
   * @returns {Promise<boolean>} True if table exists or was created, false if no permissions
   */
  static async ensureTable() {
    try {
      // First check if table exists
      const describeCommand = new DescribeTableCommand({ TableName: TABLE_NAME });
      const response = await dynamodb.send(describeCommand);
      return response.Table.TableStatus === 'ACTIVE';
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        // Table doesn't exist, try to create it
        try {
          console.log(`Creating KV table: ${TABLE_NAME}`);
          const createCommand = new CreateTableCommand({
            TableName: TABLE_NAME,
            KeySchema: [
              {
                AttributeName: 'key',
                KeyType: 'HASH'
              }
            ],
            AttributeDefinitions: [
              {
                AttributeName: 'key',
                AttributeType: 'S'
              }
            ],
            BillingMode: 'PAY_PER_REQUEST',
            // Enable TTL for automatic expiration
            TimeToLiveSpecification: {
              AttributeName: 'expires_at',
              Enabled: true
            },
            // Enable point-in-time recovery
            PointInTimeRecoverySpecification: {
              PointInTimeRecoveryEnabled: true
            },
            // Add server-side encryption
            SSESpecification: {
              Enabled: true
            }
          });

          await dynamodb.send(createCommand);
          console.log(`Created KV table: ${TABLE_NAME}, waiting for it to become active...`);

          // Wait for table to become active
          await waitUntilTableExists({ client: dynamodb, maxWaitTime: 60 }, { TableName: TABLE_NAME });
          console.log(`KV table ${TABLE_NAME} is now active`);
          return true;
        } catch (createError) {
          console.warn(`Cannot create table ${TABLE_NAME}:`, createError.message);
          return false;
        }
      } else if (error.name === 'AccessDenied' || error.name === 'UnauthorizedOperation') {
        console.warn(`No permission to access table: ${TABLE_NAME}`);
        return false;
      } else {
        // Some other error, re-throw
        throw error;
      }
    }
  }

  // Instance methods
  async getItem(tableName, key) {
    const command = new GetItemCommand({
      TableName: tableName || TABLE_NAME,
      Key: typeof key === 'object' && key.constructor === Object ? marshall(key) : key,
    });

    const { Item } = await this.client.send(command);
    return Item ? unmarshall(Item) : null;
  }

  async putItem(tableName, item) {
    const command = new PutItemCommand({
      TableName: tableName || TABLE_NAME,
      Item: marshall(item),
    });
    
    await this.client.send(command);
    return item;
  }

  async query(params) {
    const command = new QueryCommand({
      TableName: params.TableName || TABLE_NAME,
      ...params,
    });
    
    const result = await this.client.send(command);
    return {
      Items: result.Items ? result.Items.map(item => unmarshall(item)) : [],
      LastEvaluatedKey: result.LastEvaluatedKey,
      ScannedCount: result.ScannedCount,
      Count: result.Count
    };
  }

  async scan(params) {
    const command = new ScanCommand({
      TableName: params.TableName || TABLE_NAME,
      ...params,
    });
    
    const result = await this.client.send(command);
    return {
      Items: result.Items ? result.Items.map(item => unmarshall(item)) : [],
      LastEvaluatedKey: result.LastEvaluatedKey,
      ScannedCount: result.ScannedCount,
      Count: result.Count
    };
  }

  // Static methods for backward compatibility
  static async getItem(key) {
    // Ensure table exists before getting item
    const tableReady = await this.ensureTable();
    if (!tableReady) {
      console.warn(`DynamoDB table ${TABLE_NAME} not accessible - returning null`);
      return {
        item: null,
        tableUnavailable: true,
        warning: `DynamoDB table "${TABLE_NAME}" unavailable - insufficient permissions to create or access`
      };
    }

    const service = new DynamoDBService();
    const item = await service.getItem(TABLE_NAME, { key });
    return {
      item,
      tableUnavailable: false
    };
  }

  static async putItem(item) {
    // Ensure table exists before putting item
    const tableReady = await this.ensureTable();
    if (!tableReady) {
      console.warn(`DynamoDB table ${TABLE_NAME} not accessible - cannot store item`);
      return {
        success: false,
        tableUnavailable: true,
        warning: `DynamoDB table "${TABLE_NAME}" unavailable - insufficient permissions to create or access`
      };
    }

    const service = new DynamoDBService();
    const result = await service.putItem(TABLE_NAME, item);
    return {
      item: result,
      tableUnavailable: false,
      success: true
    };
  }

  static async scan(params = {}) {
    // Ensure table exists before scanning
    const tableReady = await this.ensureTable();
    if (!tableReady) {
      console.warn(`DynamoDB table ${TABLE_NAME} not accessible - cannot scan`);
      return {
        Items: [],
        tableUnavailable: true,
        warning: `DynamoDB table "${TABLE_NAME}" unavailable - insufficient permissions to create or access`
      };
    }

    const service = new DynamoDBService();
    const result = await service.scan(params);
    return {
      ...result,
      tableUnavailable: false
    };
  }

  static async query(params) {
    const service = new DynamoDBService();
    const result = await service.query({ TableName: TABLE_NAME, ...params });
    return result.Items || [];
  }
}

export default DynamoDBService;
