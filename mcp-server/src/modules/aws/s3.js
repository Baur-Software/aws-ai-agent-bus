import { GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 } from './clients.js';

const BUCKET_NAME = process.env.S3_BUCKET || 'agent-mesh-dev-artifacts-545027c4';

export class S3Service {
  static async getObject(key) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    const { Body } = await s3.send(command);
    return Body;
  }

  static async putObject(key, body, contentType = 'application/octet-stream') {
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
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });
    
    const { Contents = [] } = await s3.send(command);
    return Contents.map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
    }));
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
