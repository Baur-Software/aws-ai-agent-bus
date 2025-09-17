import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  CreateBucketCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION || 'us-west-2';
const bucketName = process.env.AGENT_MESH_ARTIFACTS_BUCKET || 'agent-mesh-artifacts';

export class S3Service {
  constructor() {
    this.client = new S3Client({ region });
    this.bucketName = bucketName;
  }

  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      return { exists: true };
    } catch (error) {
      if (error.name === 'NotFound') {
        try {
          const createParams = {
            Bucket: this.bucketName
          };

          // Only add LocationConstraint if not us-east-1
          if (region !== 'us-east-1') {
            createParams.CreateBucketConfiguration = {
              LocationConstraint: region
            };
          }

          await this.client.send(new CreateBucketCommand(createParams));
          console.log(`Created S3 bucket: ${this.bucketName}`);
          return { exists: false, created: true };
        } catch (createError) {
          console.error('Failed to create bucket:', createError);
          throw new Error(`Failed to create bucket: ${createError.message}`);
        }
      } else {
        console.error('Bucket access error:', error);
        throw new Error(`Bucket access error: ${error.message}`);
      }
    }
  }

  async getObject(key) {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      }));

      const content = await response.Body.transformToString();
      return {
        content,
        contentType: response.ContentType,
        size: response.ContentLength,
        lastModified: response.LastModified
      };
    } catch (error) {
      console.error('S3 getObject error:', error);
      throw error;
    }
  }

  async putObject(key, body, contentType = 'text/plain') {
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType
      }));

      // Generate a signed URL for access
      const signedUrl = await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        }),
        { expiresIn: 3600 } // 1 hour
      );

      return { signedUrl };
    } catch (error) {
      console.error('S3 putObject error:', error);
      throw error;
    }
  }

  async listObjects(prefix = '') {
    try {
      const response = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      }));

      return {
        objects: response.Contents || [],
        count: response.KeyCount || 0
      };
    } catch (error) {
      console.error('S3 listObjects error:', error);
      throw error;
    }
  }
}

// Create singleton instance
const s3Service = new S3Service();

export default {
  async getObject(key) {
    try {
      await s3Service.ensureBucket();
      return await s3Service.getObject(key);
    } catch (error) {
      console.error('S3 service getObject error:', error);
      throw error;
    }
  },

  async putObject(key, body, contentType) {
    try {
      await s3Service.ensureBucket();
      return await s3Service.putObject(key, body, contentType);
    } catch (error) {
      console.error('S3 service putObject error:', error);
      throw error;
    }
  },

  async listObjects(prefix) {
    try {
      await s3Service.ensureBucket();
      return await s3Service.listObjects(prefix);
    } catch (error) {
      console.error('S3 service listObjects error:', error);
      return { objects: [], count: 0 };
    }
  }
};