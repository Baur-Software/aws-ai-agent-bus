import S3Service from '../../aws/s3.js';
import EventsHandler from './events.js';

/**
 * Handler for artifact storage operations using S3.
 * Provides secure file storage and retrieval for unstructured data.
 *
 * @class ArtifactsHandler
 * @example
 * // Store a file
 * const result = await ArtifactsHandler.put({
 *   key: 'documents/report.pdf',
 *   content: fileBuffer,
 *   content_type: 'application/pdf'
 * });
 *
 * // Retrieve a file
 * const file = await ArtifactsHandler.get({ key: 'documents/report.pdf' });
 * console.log(file.content);
 */
export class ArtifactsHandler {
  /**
   * List artifacts with optional prefix filter.
   *
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} [params.prefix=''] - Prefix to filter artifacts
   * @returns {Promise<Object>} Object containing array of artifacts and metadata
   * @example
   * const result = await ArtifactsHandler.list({ prefix: 'documents/' });
   * console.log(result.items); // Array of artifact metadata
   */
  static async list({ prefix = '' } = {}) {
    try {
      const result = await S3Service.listObjects(prefix);

      const items = result.objects.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag
      }));

      // Publish list event
      try {
        await EventsHandler.send({
          detailType: 'Artifacts.List',
          detail: {
            prefix: prefix,
            count: items.length,
            totalSize: items.reduce((sum, item) => sum + (item.size || 0), 0)
          },
          source: 'mcp-server'
        });
      } catch (eventError) {
        console.warn('Failed to publish artifacts list event:', eventError);
      }

      return {
        items,
        count: items.length,
        prefix
      };
    } catch (error) {
      console.error('Artifacts list error:', error);
      if (error.message.includes('bucket')) {
        return {
          items: [],
          count: 0,
          warning: 'S3 bucket not accessible - insufficient permissions'
        };
      }
      throw error;
    }
  }

  /**
   * Retrieve an artifact by key.
   *
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.key - The key of the artifact to retrieve (required)
   * @returns {Promise<Object>} Object containing the artifact content and metadata
   * @throws {Error} If key parameter is missing
   * @example
   * const artifact = await ArtifactsHandler.get({ key: 'documents/report.pdf' });
   * console.log(artifact.content); // File content as string
   * console.log(artifact.contentType); // MIME type
   */
  static async get({ key }) {
    if (!key) {
      throw new Error('Key is required');
    }

    try {
      const result = await S3Service.getObject(key);

      // Publish get event
      try {
        await EventsHandler.send({
          detailType: 'Artifacts.Get',
          detail: {
            key: key,
            size: result.size || 0,
            contentType: result.contentType
          },
          source: 'mcp-server'
        });
      } catch (eventError) {
        console.warn('Failed to publish artifacts get event:', eventError);
      }

      return {
        key,
        content: result.content,
        contentType: result.contentType,
        size: result.size,
        lastModified: result.lastModified
      };
    } catch (error) {
      console.error('Artifacts get error:', error);
      if (error.message.includes('bucket') || error.message.includes('NoSuchKey')) {
        return {
          key,
          content: null,
          warning: error.message.includes('bucket') ?
            'S3 bucket not accessible - insufficient permissions' :
            'Artifact not found'
        };
      }
      throw error;
    }
  }

  /**
   * Store an artifact.
   *
   * @static
   * @async
   * @param {Object} params - Parameters for the request
   * @param {string} params.key - The key to store the artifact under (required)
   * @param {string|Buffer} params.content - The content to store (required)
   * @param {string} [params.content_type='text/plain'] - The MIME type of the content
   * @returns {Promise<Object>} Object containing the stored artifact metadata and access URL
   * @throws {Error} If key or content parameters are missing
   * @example
   * const result = await ArtifactsHandler.put({
   *   key: 'configs/app.json',
   *   content: '{"version": "1.0"}',
   *   content_type: 'application/json'
   * });
   * console.log(result.url); // Signed URL for access
   */
  static async put({ key, content, content_type = 'text/plain' }) {
    if (!key || content === undefined || content === null) {
      throw new Error('Key and content are required');
    }

    try {
      const result = await S3Service.putObject(key, content, content_type);

      // Publish put event
      try {
        await EventsHandler.send({
          detailType: 'Artifacts.Put',
          detail: {
            key: key,
            size: typeof content === 'string' ? content.length : content.byteLength || 0,
            contentType: content_type
          },
          source: 'mcp-server'
        });
      } catch (eventError) {
        console.warn('Failed to publish artifacts put event:', eventError);
      }

      return {
        key,
        url: result.signedUrl,
        contentType: content_type,
        size: typeof content === 'string' ? content.length : content.byteLength || 0
      };
    } catch (error) {
      console.error('Artifacts put error:', error);
      if (error.message.includes('bucket')) {
        return {
          key,
          url: null,
          warning: 'S3 bucket not accessible - insufficient permissions'
        };
      }
      throw error;
    }
  }
}

export default ArtifactsHandler;