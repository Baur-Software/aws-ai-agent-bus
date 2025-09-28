import { EventsHandler } from '../handlers/events.js';

export enum ErrorCategory {
  USER_ERROR = 'user_error',           // User input/action errors
  INFRASTRUCTURE = 'infrastructure',   // AWS service unavailable/misconfigured
  AUTHENTICATION = 'authentication',   // Auth/permission issues
  BUSINESS_LOGIC = 'business_logic',   // Application logic errors
  EXTERNAL_SERVICE = 'external_service', // Third-party service errors
  SYSTEM_ERROR = 'system_error'        // Internal system errors
}

export enum ErrorSeverity {
  LOW = 'low',         // Info/warning level
  MEDIUM = 'medium',   // Error that doesn't break functionality
  HIGH = 'high',       // Error that breaks functionality
  CRITICAL = 'critical' // System-wide failure
}

export interface CategorizedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;     // Safe message for UI
  internalMessage: string; // Detailed message for logs
  code: string;           // Error code for programmatic handling
  shouldRetry: boolean;   // Whether the operation can be retried
  metadata?: Record<string, any>; // Additional context
}

export class ErrorHandler {
  private static readonly AWS_AUTH_PATTERNS = [
    /AccessDenied/i,
    /UnauthorizedOperation/i,
    /CredentialsNotFound/i,
    /Could not load credentials/i,
    /Token expired/i,
    /InvalidAccessKeyId/i,
    /SignatureDoesNotMatch/i,
    /NoCredentialProviders/i
  ];

  private static readonly AWS_RESOURCE_PATTERNS = [
    /ResourceNotFoundException/i,
    /NoSuchBucket/i,
    /table does not exist/i,
    /bucket does not exist/i,
    /does not exist/i,
    /not found/i
  ];

  private static readonly USER_INPUT_PATTERNS = [
    /ValidationException/i,
    /Invalid.*format/i,
    /Required.*missing/i,
    /Invalid request/i
  ];

  /**
   * Categorizes an error and returns user-safe information
   */
  static categorizeError(error: any, context?: string): CategorizedError {
    const errorMessage = this.extractErrorMessage(error);
    const errorName = error?.name || '';

    // AWS Authentication Issues
    if (this.matchesPatterns(errorMessage, this.AWS_AUTH_PATTERNS) ||
        this.matchesPatterns(errorName, this.AWS_AUTH_PATTERNS)) {
      return {
        category: ErrorCategory.INFRASTRUCTURE,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'Service temporarily unavailable. Our team has been notified.',
        internalMessage: `AWS Auth Error: ${errorMessage}`,
        code: 'AWS_AUTH_ERROR',
        shouldRetry: false,
        metadata: { context, awsError: true }
      };
    }

    // AWS Resource Issues
    if (this.matchesPatterns(errorMessage, this.AWS_RESOURCE_PATTERNS)) {
      return {
        category: ErrorCategory.INFRASTRUCTURE,
        severity: ErrorSeverity.LOW,
        userMessage: 'This feature is not yet available. We\'re working on it!',
        internalMessage: `AWS Resource Error: ${errorMessage}`,
        code: 'AWS_RESOURCE_ERROR',
        shouldRetry: false,
        metadata: { context, awsError: true }
      };
    }

    // User Input Validation
    if (this.matchesPatterns(errorMessage, this.USER_INPUT_PATTERNS)) {
      return {
        category: ErrorCategory.USER_ERROR,
        severity: ErrorSeverity.LOW,
        userMessage: this.sanitizeUserMessage(errorMessage),
        internalMessage: errorMessage,
        code: 'VALIDATION_ERROR',
        shouldRetry: false,
        metadata: { context }
      };
    }

    // Network/Timeout Errors
    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('Network')) {
      return {
        category: ErrorCategory.EXTERNAL_SERVICE,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'Connection issue. Please try again in a moment.',
        internalMessage: `Network Error: ${errorMessage}`,
        code: 'NETWORK_ERROR',
        shouldRetry: true,
        metadata: { context }
      };
    }

    // Production Auth Warning (specific to your issue)
    if (errorMessage.includes('Production auth not implemented') ||
        errorMessage.includes('Authentication failed')) {
      return {
        category: ErrorCategory.INFRASTRUCTURE,
        severity: ErrorSeverity.LOW,
        userMessage: 'Authentication service is being configured. Please try again later.',
        internalMessage: `Auth Service Configuration: ${errorMessage}`,
        code: 'AUTH_SERVICE_CONFIG',
        shouldRetry: true,
        metadata: { context, developmentMode: true }
      };
    }

    // MCP connection errors
    if (errorMessage.includes('Connection closed') || errorMessage.includes('EPIPE') ||
        errorName.includes('McpError') || errorMessage.includes('MCP error') ||
        errorMessage.includes('JSON Parse error') || errorMessage.includes('ZodError') ||
        errorMessage.includes('timed out') || errorMessage.includes('circuit breaker') ||
        errorMessage.includes('permanently disabled')) {

      const isCircuitBreaker = errorMessage.includes('circuit breaker');
      const isPermanentlyDisabled = errorMessage.includes('permanently disabled');

      return {
        category: ErrorCategory.EXTERNAL_SERVICE,
        severity: isPermanentlyDisabled ? ErrorSeverity.LOW : isCircuitBreaker ? ErrorSeverity.LOW : ErrorSeverity.MEDIUM,
        userMessage: isPermanentlyDisabled
          ? 'Agent service is temporarily unavailable due to configuration issues. Using fallback functionality.'
          : isCircuitBreaker
            ? 'Agent service is temporarily disabled due to recent failures. Please try again in a minute.'
            : 'Agent service temporarily unavailable. Please try again in a moment.',
        internalMessage: `MCP Connection Error: ${errorMessage}`,
        code: isPermanentlyDisabled ? 'MCP_PERMANENTLY_DISABLED' : isCircuitBreaker ? 'MCP_CIRCUIT_BREAKER' : 'MCP_CONNECTION_ERROR',
        shouldRetry: false, // Don't retry any MCP errors immediately
        metadata: { context, mcpError: true, circuitBreaker: isCircuitBreaker, permanentlyDisabled: isPermanentlyDisabled }
      };
    }

    // Default case - treat as system error
    return {
      category: ErrorCategory.SYSTEM_ERROR,
      severity: ErrorSeverity.HIGH,
      userMessage: 'An unexpected error occurred. Please try again.',
      internalMessage: errorMessage,
      code: 'SYSTEM_ERROR',
      shouldRetry: true,
      metadata: { context }
    };
  }

  /**
   * Logs error appropriately and sends events if needed
   */
  static async handleError(error: any, context?: string, userId?: string): Promise<CategorizedError> {
    const categorized = this.categorizeError(error, context);

    // Log based on severity
    switch (categorized.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(`🚨 CRITICAL ERROR [${categorized.code}]:`, categorized.internalMessage, categorized.metadata);
        break;
      case ErrorSeverity.HIGH:
        console.error(`❌ ERROR [${categorized.code}]:`, categorized.internalMessage);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(`⚠️ WARNING [${categorized.code}]:`, categorized.internalMessage);
        break;
      case ErrorSeverity.LOW:
        console.info(`ℹ️ INFO [${categorized.code}]:`, categorized.internalMessage);
        break;
    }

    // Send telemetry events for infrastructure issues
    if (categorized.category === ErrorCategory.INFRASTRUCTURE &&
        categorized.severity !== ErrorSeverity.LOW) {
      try {
        await EventsHandler.send({
          detailType: 'Infrastructure Error',
          detail: {
            category: categorized.category,
            severity: categorized.severity,
            code: categorized.code,
            context,
            userId,
            timestamp: new Date().toISOString(),
            metadata: categorized.metadata
          },
          source: 'dashboard-server'
        });
      } catch (eventError) {
        console.warn('Failed to send error telemetry:', eventError);
      }
    }

    return categorized;
  }

  /**
   * Creates a user-safe error response for APIs
   */
  static createErrorResponse(categorizedError: CategorizedError) {
    return {
      success: false,
      error: {
        message: categorizedError.userMessage,
        code: categorizedError.code,
        category: categorizedError.category,
        shouldRetry: categorizedError.shouldRetry
      },
      // Include retry info for exponential backoff
      retryInfo: categorizedError.shouldRetry ? {
        retryable: true,
        backoffMs: categorizedError.severity === ErrorSeverity.HIGH ? 5000 : 2000
      } : undefined
    };
  }

  private static extractErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    if (typeof error === 'object') return JSON.stringify(error);
    return 'Unknown error';
  }

  private static matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text));
  }

  private static sanitizeUserMessage(message: string): string {
    // Remove technical details but keep helpful info
    return message
      .replace(/\b[A-Z0-9]{20,}\b/g, '[ID]') // Replace AWS resource IDs
      .replace(/arn:aws:[^:]*:[^:]*:[^:]*:[^:]*:/g, '[AWS Resource]:') // Replace ARNs
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // Replace IP addresses
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '[UUID]'); // Replace UUIDs
  }
}

export default ErrorHandler;