import { GetItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { dynamodb } from './clients.js';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'agent-mesh-dev-kv';

export class DynamoDBService {
  static async getItem(key) {
    const command = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall(key),
    });
    
    const { Item } = await dynamodb.send(command);
    return Item ? unmarshall(Item) : null;
  }

  static async putItem(item) {
    const command = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item),
    });
    
    await dynamodb.send(command);
    return item;
  }

  static async query(params) {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      ...params,
    });
    
    const { Items } = await dynamodb.send(command);
    return Items ? Items.map(item => unmarshall(item)) : [];
  }
}

export default DynamoDBService;
