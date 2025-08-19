import S3Service from '../../aws/s3.js';

export class ArtifactsHandler {
  static async list({ prefix = '' } = {}) {
    const objects = await S3Service.listObjects(prefix);
    return { items: objects };
  }

  static async get({ key } = {}) {
    if (!key) {
      throw new Error('Key is required');
    }

    const object = await S3Service.getObject(key);
    return {
      key,
      content: await object.transformToString(),
    };
  }

  static async put({ key, content, content_type = 'text/plain' } = {}) {
    if (!key || !content) {
      throw new Error('Key and content are required');
    }

    await S3Service.putObject(key, content, content_type);
    const url = await S3Service.getSignedUrl(key);
    
    return {
      key,
      url,
      content_type,
    };
  }
}

export default ArtifactsHandler;
