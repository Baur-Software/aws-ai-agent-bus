import { ScanCommand, QueryCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ListObjectsV2Command, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

interface KVMetrics {
  totalKeys: number;
  totalSize: number;
}

interface ArtifactsMetrics {
  totalFiles: number;
  totalSize: number;
}

interface AllMetrics {
  kv: KVMetrics;
  artifacts: ArtifactsMetrics;
  lastUpdated: string;
}

interface ActivityEvent {
  id: number;
  action: string;
  type: string;
  timestamp: string;
}

interface DynamoDBItem {
  expires_at?: number;
  value?: any;
}

export class MetricsAggregator {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private kvTable: string;
  private artifactsBucket: string;

  constructor(dynamodb: DynamoDBClient, s3: S3Client) {
    this.dynamodb = dynamodb;
    this.s3 = s3;
    this.kvTable = process.env.AGENT_MESH_KV_TABLE || 'agent-mesh-dev-kv';
    this.artifactsBucket = process.env.AGENT_MESH_ARTIFACTS_BUCKET || 'agent-mesh-dev-artifacts';
  }

  async getAllMetrics(): Promise<AllMetrics> {
    const [kvMetrics, artifactsMetrics] = await Promise.all([
      this.getKVMetrics(),
      this.getArtifactsMetrics()
    ]);

    return {
      kv: kvMetrics,
      artifacts: artifactsMetrics,
      lastUpdated: new Date().toISOString()
    };
  }

  async getKVMetrics(): Promise<KVMetrics> {
    try {
      const command = new ScanCommand({
        TableName: this.kvTable,
        FilterExpression: 'begins_with(#k, :prefix)',
        ExpressionAttributeNames: {
          '#k': 'key'
        },
        ExpressionAttributeValues: {
          ':prefix': { S: 'KV#' }
        }
      });

      const result = await this.dynamodb.send(command);

      let totalKeys = 0;
      let totalSize = 0;

      if (result.Items) {
        result.Items.forEach(item => {
          const unmarshalled = unmarshall(item);

          // Check if not expired
          if (!this.isExpired(unmarshalled)) {
            totalKeys++;
            if (unmarshalled.value) {
              const size = typeof unmarshalled.value === 'string'
                ? unmarshalled.value.length
                : JSON.stringify(unmarshalled.value).length;
              totalSize += size / 1024; // Convert to KB
            }
          }
        });
      }

      return {
        totalKeys,
        totalSize: Math.round(totalSize * 100) / 100
      };
    } catch (error) {
      console.error('Error getting KV metrics:', error);
      return { totalKeys: 0, totalSize: 0 };
    }
  }

  async getArtifactsMetrics(): Promise<ArtifactsMetrics> {
    try {
      // First check if bucket exists
      try {
        await this.s3.send(new HeadBucketCommand({ Bucket: this.artifactsBucket }));
      } catch (error: any) {
        console.warn('Artifacts bucket not accessible:', error.name);
        return { totalFiles: 0, totalSize: 0 };
      }

      const command = new ListObjectsV2Command({
        Bucket: this.artifactsBucket
      });

      const result = await this.s3.send(command);

      const totalFiles = result.Contents?.length || 0;
      const totalSize = result.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0;

      return {
        totalFiles,
        totalSize: totalSize / 1024 // Convert to KB
      };
    } catch (error) {
      console.error('Error getting artifacts metrics:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }

  async getRecentActivity(): Promise<ActivityEvent[]> {
    try {
      // Query the events table for recent activity
      const command = new QueryCommand({
        TableName: process.env.AGENT_MESH_EVENTS_TABLE || 'agent-mesh-dev-events',
        IndexName: 'TimestampIndex',
        KeyConditionExpression: '#ts > :since',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':since': { S: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } // Last 24 hours
        },
        ScanIndexForward: false, // Most recent first
        Limit: 50
      });

      const result = await this.dynamodb.send(command);

      if (result.Items) {
        return result.Items.map((item, index) => {
          const unmarshalled = unmarshall(item);
          return {
            id: Date.now() - index, // Generate unique ID
            action: unmarshalled.detailType || 'Unknown Event',
            type: this.getActivityType(unmarshalled.detailType),
            timestamp: unmarshalled.timestamp || new Date().toISOString()
          };
        });
      }

      return [];
    } catch (error) {
      console.warn('Could not fetch recent activity from events table:', error);
      // Return empty array instead of mock data when events table is unavailable
      return [];
    }
  }

  private getActivityType(detailType: string): string {
    if (!detailType) return 'info';

    const type = detailType.toLowerCase();
    if (type.includes('error') || type.includes('failed')) return 'error';
    if (type.includes('success') || type.includes('completed') || type.includes('uploaded')) return 'success';
    if (type.includes('warning') || type.includes('expired')) return 'warning';
    return 'info';
  }

  private isExpired(item: DynamoDBItem): boolean {
    if (!item.expires_at) return false;
    return Date.now() / 1000 > item.expires_at;
  }
}