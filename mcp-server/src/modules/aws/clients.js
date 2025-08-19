import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SFNClient } from '@aws-sdk/client-sfn';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { fromIni } from '@aws-sdk/credential-providers';

// AWS Client Configuration
const config = {
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: fromIni({ profile: process.env.AWS_PROFILE || 'baursoftware' }),
  ...(process.env.AWS_ENDPOINT_URL && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    forcePathStyle: true,
  }),
};

// Initialize AWS service clients
export const dynamodb = new DynamoDBClient(config);
export const s3 = new S3Client(config);
export const stepFunctions = new SFNClient(config);
export const eventBridge = new EventBridgeClient(config);

export default {
  dynamodb,
  s3,
  stepFunctions,
  eventBridge,
};