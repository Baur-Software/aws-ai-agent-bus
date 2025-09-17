import { GetObjectCommand, PutObjectCommand, ListObjectsV2Command, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 } from './clients.js';

const BUCKET_NAME = process.env.AGENT_MESH_ARTIFACTS_BUCKET || process.env.S3_BUCKET || 'agent-mesh-artifacts';

export class S3Service {
  /**
   * Ensures the artifacts bucket exists, creating it if the user has permissions.
   * This enables seamless operation for multi-user agent bus scenarios.
   *
   * @static
   * @async
   * @returns {Promise<boolean>} True if bucket exists or was created, false if no permissions
   */
  static async ensureBucket() {
    try {
      // First check if bucket exists
      const headCommand = new HeadBucketCommand({ Bucket: BUCKET_NAME });
      await s3.send(headCommand);
      return true; // Bucket exists and we have access
    } catch (error) {
      if (error.name === 'NotFound' || error.name === 'NoSuchBucket') {
        // Bucket doesn't exist, try to create it
        try {
          console.log(`Creating artifacts bucket: ${BUCKET_NAME}`);
          const createCommand = new CreateBucketCommand({
            Bucket: BUCKET_NAME,
            // Add CreateBucketConfiguration for regions other than us-east-1
            ...(process.env.AWS_REGION && process.env.AWS_REGION !== 'us-east-1' && {
              CreateBucketConfiguration: {
                LocationConstraint: process.env.AWS_REGION
              }
            })
          });
          await s3.send(createCommand);
          console.log(`Successfully created artifacts bucket: ${BUCKET_NAME}`);
          return true;
        } catch (createError) {
          console.warn(`Cannot create bucket ${BUCKET_NAME}:`, createError.message);
          return false;
        }
      } else if (error.name === 'Forbidden') {
        console.warn(`No permission to access bucket: ${BUCKET_NAME}`);
        return false;
      } else {
        // Some other error, re-throw
        throw error;
      }
    }
  }

  static async getObject(key) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    const { Body } = await s3.send(command);
    return Body;
  }

  static async putObject(key, body, contentType = 'application/octet-stream') {
    // Ensure bucket exists before putting object
    const bucketReady = await this.ensureBucket();
    if (!bucketReady) {
      throw new Error(`Bucket ${BUCKET_NAME} is not accessible and cannot be created`);
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3.send(command);
    return { key };
  }

  static async listObjects(prefix = '') {
    // Ensure bucket exists before listing
    const bucketReady = await this.ensureBucket();
    if (!bucketReady) {
      // Return result object with warning instead of throwing
      console.warn(`Bucket ${BUCKET_NAME} not accessible - returning empty list`);
      return {
        objects: [],
        bucketUnavailable: true,
        warning: `S3 bucket "${BUCKET_NAME}" unavailable - insufficient permissions to create or access`
      };
    }

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });

    const { Contents = [] } = await s3.send(command);
    return {
      objects: Contents.map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
      })),
      bucketUnavailable: false
    };
  }

  static async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    return getSignedUrl(s3, command, { expiresIn });
  }
}

export default S3Service;
