import S3Service from '../../aws/s3.js';

/**
 * Handler for artifact storage and retrieval using S3.
 * Manages file uploads, downloads, and listing with signed URL generation.
 * 
 * @class ArtifactsHandler
 * @example
 * // Upload a text file
 * const result = await ArtifactsHandler.put({
 *   key: 'documents/report.txt',
 *   content: 'Report content here',
 *   content_type: 'text/plain'
 * });
 * console.log(result.url); // Signed URL for access
 */
export class ArtifactsHandler {
  /**
   * List artifacts in S3 bucket with optional prefix filtering.
   * Returns metadata for all matching objects including size and modification time.
   * 
   * @static
   * @async
   * @param {Object} [params={}] - Parameters for the request
   * @param {string} [params.prefix=''] - Prefix to filter objects (optional)
   * @returns {Promise<Object>} Object containing array of artifact items
   * @example
   * // List all artifacts
   * const all = await ArtifactsHandler.list();
   * 
   * // List artifacts in specific folder
   * const reports = await ArtifactsHandler.list({ prefix: 'reports/' });
   * console.log(reports.items); // Array of S3 objects
   */
  static async list({ prefix = '' } = {}) {
    const objects = await S3Service.listObjects(prefix);
    return { items: objects };
  }

  /**
   * Retrieve an artifact's content from S3.
   * Downloads the object and returns its content as a string.
   * 
   * @static
   * @async
   * @param {Object} [params={}] - Parameters for the request
   * @param {string} params.key - S3 object key to retrieve (required)
   * @returns {Promise<Object>} Object containing key and content
   * @throws {Error} If key parameter is missing or object doesn't exist
   * @example
   * const artifact = await ArtifactsHandler.get({ key: 'documents/report.txt' });
   * console.log(artifact.content); // File content as string
   */
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

  /**
   * Store an artifact in S3 bucket.
   * Uploads content with specified MIME type and generates a signed URL for access.
   * 
   * @static
   * @async
   * @param {Object} [params={}] - Parameters for the request
   * @param {string} params.key - S3 object key for storage (required)
   * @param {string|Buffer} params.content - Content to store (required)
   * @param {string} [params.content_type='text/plain'] - MIME type for the content
   * @returns {Promise<Object>} Object containing key, signed URL, and content type
   * @throws {Error} If key or content parameters are missing
   * @example
   * // Upload text content
   * const result = await ArtifactsHandler.put({
   *   key: 'data/output.json',
   *   content: JSON.stringify(data),
   *   content_type: 'application/json'
   * });
   * console.log(result.url); // Signed URL for downloading
   */
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
