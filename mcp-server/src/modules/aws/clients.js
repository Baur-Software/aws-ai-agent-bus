import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'us-west-2';

export const eventBridge = new EventBridgeClient({ region });
export const secretsManager = new SecretsManagerClient({ region });
export const dynamodb = new DynamoDBClient({ region });
export const s3 = new S3Client({ region });