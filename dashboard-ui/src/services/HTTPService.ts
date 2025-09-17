// HTTP Service Client
// Provides clean abstraction over HTTP API calls with authentication and error handling

export interface HTTPRequestParams {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  auth?: AuthConfig;
  retries?: number;
  validateStatus?: (status: number) => boolean;
}

export interface AuthConfig {
  type: 'bearer' | 'basic' | 'apikey' | 'oauth2';
  token?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  headerName?: string; // For API key auth
}

export interface HTTPResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  method: string;
  duration: number;
}

export interface URLBuilderParams {
  baseUrl: string;
  path?: string;
  params?: Record<string, any>;
  removeNullValues?: boolean;
}

export interface URLBuilderResult {
  url: string;
  baseUrl: string;
  path: string;
  params: Record<string, any>;
}

export class HTTPService {
  private defaultTimeout: number = 30000; // 30 seconds
  private defaultRetries: number = 3;
  private baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  constructor(config?: { timeout?: number; retries?: number; baseHeaders?: Record<string, string> }) {
    if (config?.timeout) this.defaultTimeout = config.timeout;
    if (config?.retries) this.defaultRetries = config.retries;
    if (config?.baseHeaders) this.baseHeaders = { ...this.baseHeaders, ...config.baseHeaders };
  }

  async get<T = any>(url: string, options: Omit<HTTPRequestParams, 'url' | 'method'> = {}): Promise<HTTPResponse<T>> {
    return this.request<T>({ ...options, url, method: 'GET' });
  }

  async post<T = any>(url: string, body?: any, options: Omit<HTTPRequestParams, 'url' | 'method' | 'body'> = {}): Promise<HTTPResponse<T>> {
    return this.request<T>({ ...options, url, method: 'POST', body });
  }

  async put<T = any>(url: string, body?: any, options: Omit<HTTPRequestParams, 'url' | 'method' | 'body'> = {}): Promise<HTTPResponse<T>> {
    return this.request<T>({ ...options, url, method: 'PUT', body });
  }

  async delete<T = any>(url: string, options: Omit<HTTPRequestParams, 'url' | 'method'> = {}): Promise<HTTPResponse<T>> {
    return this.request<T>({ ...options, url, method: 'DELETE' });
  }

  async patch<T = any>(url: string, body?: any, options: Omit<HTTPRequestParams, 'url' | 'method' | 'body'> = {}): Promise<HTTPResponse<T>> {
    return this.request<T>({ ...options, url, method: 'PATCH', body });
  }

  async request<T = any>(params: HTTPRequestParams): Promise<HTTPResponse<T>> {
    const startTime = Date.now();
    const retries = params.retries ?? this.defaultRetries;
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.executeRequest<T>(params);
        response.duration = Date.now() - startTime;
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx) unless specifically configured
        if (error instanceof HTTPError && error.status >= 400 && error.status < 500 && attempt === 0) {
          if (!params.validateStatus || !params.validateStatus(error.status)) {
            break;
          }
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private async executeRequest<T = any>(params: HTTPRequestParams): Promise<HTTPResponse<T>> {
    const { url, method, body, timeout = this.defaultTimeout, auth, validateStatus } = params;
    const headers = { ...this.baseHeaders, ...params.headers };

    // Add authentication
    if (auth) {
      this.addAuthentication(headers, auth);
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeout)
    };

    // Add body for non-GET requests
    if (body !== undefined && method !== 'GET') {
      if (typeof body === 'string') {
        requestOptions.body = body;
      } else if (body instanceof FormData) {
        requestOptions.body = body;
        // Remove Content-Type header for FormData (browser will set it with boundary)
        delete (requestOptions.headers as Record<string, string>)['Content-Type'];
      } else {
        requestOptions.body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(url, requestOptions);
      
      // Check if status is considered successful
      const isSuccessful = validateStatus ? validateStatus(response.status) : (response.status >= 200 && response.status < 300);
      
      if (!isSuccessful) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new HTTPError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText,
          errorText,
          url,
          method
        );
      }

      // Parse response data
      let data: T;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/')) {
        data = (await response.text()) as T;
      } else {
        // For binary data, return as blob
        data = (await response.blob()) as T;
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url,
        method,
        duration: 0 // Will be set by the caller
      };

    } catch (error) {
      if (error instanceof HTTPError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new HTTPError(
          `Request timeout after ${timeout}ms`,
          408,
          'Request Timeout',
          'Request was aborted due to timeout',
          url,
          method
        );
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new HTTPError(
          'Network error or CORS issue',
          0,
          'Network Error',
          error.message,
          url,
          method
        );
      }

      throw new HTTPError(
        `Request failed: ${error.message}`,
        0,
        'Unknown Error',
        error.message,
        url,
        method
      );
    }
  }

  private addAuthentication(headers: Record<string, string>, auth: AuthConfig): void {
    switch (auth.type.toLowerCase()) {
      case 'bearer':
        if (auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        }
        break;

      case 'basic':
        if (auth.username && auth.password) {
          const credentials = btoa(`${auth.username}:${auth.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'apikey':
        if (auth.apiKey) {
          const headerName = auth.headerName || 'X-API-Key';
          headers[headerName] = auth.apiKey;
        }
        break;

      case 'oauth2':
        if (auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        }
        break;

      default:
        console.warn(`Unknown authentication type: ${auth.type}`);
    }
  }

  // URL building utilities
  buildUrl(params: URLBuilderParams): URLBuilderResult {
    const { baseUrl, path = '', params: queryParams = {}, removeNullValues = true } = params;
    
    let url = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    if (path) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      url += cleanPath;
    }

    // Build query string
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && (!removeNullValues || value !== null)) {
        searchParams.append(key, value.toString());
      }
    });

    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return {
      url,
      baseUrl,
      path,
      params: queryParams
    };
  }

  // JSON utilities
  parseJson<T = any>(input: string | any): T {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch (error) {
        throw new HTTPError(`Invalid JSON: ${error.message}`, 400, 'Bad Request', input, '', 'PARSE');
      }
    }
    return input;
  }

  stringifyJson(data: any, pretty: boolean = false): string {
    try {
      return JSON.stringify(data, null, pretty ? 2 : 0);
    } catch (error) {
      throw new HTTPError(`JSON stringify failed: ${error.message}`, 500, 'Internal Error', data, '', 'STRINGIFY');
    }
  }

  // Utility methods
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check method
  async healthCheck(url: string): Promise<boolean> {
    try {
      const response = await this.get(url, { timeout: 5000, retries: 0 });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error(`Health check failed for ${url}:`, error.message);
      return false;
    }
  }

  // Batch request method
  async batchRequest<T = any>(requests: HTTPRequestParams[]): Promise<Array<HTTPResponse<T> | HTTPError>> {
    const results = await Promise.allSettled(
      requests.map(params => this.request<T>(params))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : new HTTPError(
        result.reason.message,
        result.reason.status || 0,
        result.reason.statusText || 'Error',
        result.reason.details || '',
        result.reason.url || '',
        result.reason.method || 'UNKNOWN'
      )
    );
  }

  // Create a configured instance for a specific API
  createAPIClient(config: {
    baseUrl: string;
    defaultHeaders?: Record<string, string>;
    auth?: AuthConfig;
    timeout?: number;
  }): APIClient {
    return new APIClient(this, config);
  }
}

// Specialized API client for specific services
export class APIClient {
  constructor(
    private httpService: HTTPService,
    private config: {
      baseUrl: string;
      defaultHeaders?: Record<string, string>;
      auth?: AuthConfig;
      timeout?: number;
    }
  ) {}

  async get<T = any>(path: string, params?: Record<string, any>, options?: Partial<HTTPRequestParams>): Promise<HTTPResponse<T>> {
    const url = this.httpService.buildUrl({ baseUrl: this.config.baseUrl, path, params }).url;
    return this.httpService.get<T>(url, {
      ...options,
      headers: { ...this.config.defaultHeaders, ...options?.headers },
      auth: options?.auth || this.config.auth,
      timeout: options?.timeout || this.config.timeout
    });
  }

  async post<T = any>(path: string, body?: any, options?: Partial<HTTPRequestParams>): Promise<HTTPResponse<T>> {
    const url = this.httpService.buildUrl({ baseUrl: this.config.baseUrl, path }).url;
    return this.httpService.post<T>(url, body, {
      ...options,
      headers: { ...this.config.defaultHeaders, ...options?.headers },
      auth: options?.auth || this.config.auth,
      timeout: options?.timeout || this.config.timeout
    });
  }

  async put<T = any>(path: string, body?: any, options?: Partial<HTTPRequestParams>): Promise<HTTPResponse<T>> {
    const url = this.httpService.buildUrl({ baseUrl: this.config.baseUrl, path }).url;
    return this.httpService.put<T>(url, body, {
      ...options,
      headers: { ...this.config.defaultHeaders, ...options?.headers },
      auth: options?.auth || this.config.auth,
      timeout: options?.timeout || this.config.timeout
    });
  }

  async delete<T = any>(path: string, options?: Partial<HTTPRequestParams>): Promise<HTTPResponse<T>> {
    const url = this.httpService.buildUrl({ baseUrl: this.config.baseUrl, path }).url;
    return this.httpService.delete<T>(url, {
      ...options,
      headers: { ...this.config.defaultHeaders, ...options?.headers },
      auth: options?.auth || this.config.auth,
      timeout: options?.timeout || this.config.timeout
    });
  }
}

export class HTTPError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public details: string,
    public url: string,
    public method: string
  ) {
    super(message);
    this.name = 'HTTPError';
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isTimeoutError(): boolean {
    return this.status === 408 || this.message.includes('timeout');
  }
}

// Factory function for easy instantiation
export function createHTTPService(config?: {
  timeout?: number;
  retries?: number;
  baseHeaders?: Record<string, string>;
}): HTTPService {
  return new HTTPService(config);
}