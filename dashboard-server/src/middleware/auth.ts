import { WebSocket } from 'ws';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * User context interface for multi-tenant operations
 */
export interface UserContext {
  userId: string;
  organizationId: string;
  role: 'admin' | 'user' | 'viewer';
  email?: string;
  name?: string;
}

/**
 * Organization membership interface
 */
export interface OrganizationMembership {
  orgId: string;
  orgSlug: string;
  role: 'owner' | 'admin' | 'member';
  awsAccountId?: string;
}

/**
 * JWT payload interface for multi-org support
 */
export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  organizationMemberships: OrganizationMembership[];
  personalNamespace: string;
  organizationId?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Authenticated Express request interface
 */
export interface AuthenticatedRequest extends Request {
  user?: UserContext;
}

/**
 * Authentication middleware for dashboard-server
 * Supports feature flag for dev/test environments
 */
export class AuthMiddleware {
  private static readonly DEV_USER_CONTEXT: UserContext = {
    userId: 'user-demo-123',
    organizationId: 'acme',
    role: 'admin',
    email: 'demo@acme.com',
    name: 'Demo User'
  };

  /**
   * Check if development authentication is enabled
   */
  private static get isDevAuthEnabled(): boolean {
    return process.env.ENABLE_DEV_AUTH === 'true' || process.env.NODE_ENV === 'development';
  }

  /**
   * Authenticate WebSocket connection and extract user context
   */
  static authenticateWebSocket(ws: WebSocket, request: any): UserContext | null {
    if (this.isDevAuthEnabled) {
      console.log('🔧 Dev auth enabled - using hardcoded user context:', this.DEV_USER_CONTEXT);
      return this.DEV_USER_CONTEXT;
    }

    // TODO: Production authentication
    // Extract JWT from query params or headers
    // const token = request.url?.split('token=')[1] || request.headers.authorization?.split(' ')[1];
    // return this.validateJWT(token);

    console.warn('⚠️ Production auth not implemented - rejecting connection');
    return null;
  }

  /**
   * Authenticate HTTP request and extract user context
   */
  static authenticateRequest(headers: Record<string, string>): UserContext | null {
    if (this.isDevAuthEnabled) {
      return this.DEV_USER_CONTEXT;
    }

    // TODO: Production authentication
    // const token = headers.authorization?.split(' ')[1];
    // return this.validateJWT(token);

    return null;
  }

  /**
   * Generate S3 IAM tags for user context (for future IAM integration)
   */
  static generateIAMTags(userContext: UserContext): Record<string, string> {
    return {
      'UserId': userContext.userId,
      'OrganizationId': userContext.organizationId,
      'OrganizationRole': userContext.role,
      'Environment': process.env.NODE_ENV || 'dev'
    };
  }

  /**
   * Check if user has permission for specific operation
   */
  static hasPermission(
    userContext: UserContext,
    operation: 'read' | 'write' | 'delete' | 'admin',
    resourceOwner?: { ownerType: 'organization' | 'user'; ownerId: string }
  ): boolean {
    // Admin role has all permissions
    if (userContext.role === 'admin') {
      return true;
    }

    // Resource ownership check
    if (resourceOwner) {
      if (resourceOwner.ownerType === 'user' && resourceOwner.ownerId === userContext.userId) {
        return true; // User owns the resource
      }
      if (resourceOwner.ownerType === 'organization' && resourceOwner.ownerId === userContext.organizationId) {
        return operation !== 'admin'; // Org members can read/write but not admin org resources
      }
    }

    // Default permissions by role
    switch (userContext.role) {
      case 'user':
        return operation === 'read' || operation === 'write';
      case 'viewer':
        return operation === 'read';
      default:
        return false;
    }
  }

  /**
   * JWT token management
   *
   * SECURITY: JWT_SECRET is required in production environments.
   * The application will fail to start if JWT_SECRET is not set when
   * NODE_ENV is 'production' or ENABLE_DEV_AUTH is not 'true'.
   */
  private static _jwtSecretValidated = false;
  private static _devFallbackWarned = false;

  private static get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    // In production mode, JWT_SECRET is required
    if (!this.isDevAuthEnabled) {
      if (!secret) {
        throw new Error(
          'SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
          'Set JWT_SECRET to a strong, randomly generated secret (min 32 characters). ' +
          'To enable development mode, set ENABLE_DEV_AUTH=true or NODE_ENV=development.'
        );
      }

      // Warn if secret appears weak (only check once)
      if (!this._jwtSecretValidated) {
        if (secret.length < 32) {
          console.warn('⚠️ WARNING: JWT_SECRET should be at least 32 characters for security.');
        }
        this._jwtSecretValidated = true;
      }
    }

    // In dev mode, allow a fallback but warn (only once to avoid log pollution)
    if (!secret) {
      if (!this._devFallbackWarned) {
        console.warn('⚠️ DEV MODE: Using fallback JWT secret. Do not use in production!');
        this._devFallbackWarned = true;
      }
      return 'dev-only-secret-not-for-production-use';
    }

    return secret;
  }

  private static get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || '24h';
  }

  /**
   * Generate JWT token for user
   */
  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn } as any);
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): JWTPayload {
    return jwt.verify(token, this.jwtSecret) as JWTPayload;
  }

  /**
   * Validate JWT and return user context
   */
  private static validateJWT(token: string): UserContext | null {
    try {
      const payload = this.verifyToken(token);
      return {
        userId: payload.userId,
        organizationId: payload.organizationId,
        role: payload.role as 'admin' | 'user' | 'viewer',
        email: payload.email,
        name: payload.name
      };
    } catch (error) {
      console.error('JWT validation failed:', error);
      return null;
    }
  }

  /**
   * Express middleware to authenticate HTTP requests
   */
  static authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Dev mode bypass
      if (this.isDevAuthEnabled) {
        const devUserId = req.headers['x-user-id'] as string;
        if (devUserId) {
          req.user = { ...this.DEV_USER_CONTEXT, userId: devUserId };
          return next();
        }
        req.user = this.DEV_USER_CONTEXT;
        return next();
      }

      // Extract JWT token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
      }

      const token = authHeader.substring(7);
      const userContext = this.validateJWT(token);

      if (!userContext) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      req.user = userContext;
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  /**
   * Middleware to require specific roles
   */
  static requireRole = (allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  };

  /**
   * Middleware to require admin role
   */
  static requireAdmin = AuthMiddleware.requireRole(['admin']);

  /**
   * Validate authentication configuration at startup.
   * Call this early in application startup to fail fast if misconfigured.
   *
   * @throws Error if JWT_SECRET is missing in production mode
   */
  static validateConfiguration(): void {
    // Trigger the jwtSecret getter to validate configuration
    // This will throw if JWT_SECRET is required but missing
    const _ = this.jwtSecret;
    console.log('✅ Authentication configuration validated');
  }

  /**
   * Optional authentication - sets user if token is valid but doesn't require it
   */
  static optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const userContext = this.validateJWT(token);
        if (userContext) {
          req.user = userContext;
        }
      }
      next();
    } catch (error) {
      // Ignore errors for optional auth
      next();
    }
  };
}

export default AuthMiddleware;