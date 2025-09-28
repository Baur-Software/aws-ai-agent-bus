import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
    JsonWebTokenError: class JsonWebTokenError extends Error {},
    TokenExpiredError: class TokenExpiredError extends Error {}
  }
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn()
  }
}));

describe('AuthMiddleware', () => {
  let AuthMiddleware;
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeAll(async () => {
    // Import after mocking
    const module = await import('../../src/middleware/auth');
    AuthMiddleware = module.default;
  });

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    mockNext = vi.fn();

    // Clear all mocks
    vi.clearAllMocks();

    // Reset environment
    process.env.ENABLE_DEV_AUTH = 'false';
    process.env.NODE_ENV = 'test';
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-123',
        role: 'admin'
      };

      const mockToken = 'mock-jwt-token';
      jwt.sign.mockReturnValue(mockToken);

      const token = AuthMiddleware.generateToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        expect.any(String), // JWT secret
        { expiresIn: expect.any(String) }
      );
      expect(token).toBe(mockToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode JWT token', () => {
      const mockToken = 'mock-jwt-token';
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-123',
        role: 'admin'
      };

      jwt.verify.mockReturnValue(mockPayload);

      const result = AuthMiddleware.verifyToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
      expect(result).toBe(mockPayload);
    });
  });

  describe('authenticate middleware', () => {
    it('should authenticate user with valid token in production mode', async () => {
      const mockToken = 'Bearer valid-token';
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-123',
        role: 'admin'
      };

      mockRequest.headers.authorization = mockToken;
      jwt.verify.mockReturnValue(mockPayload);

      await AuthMiddleware.authenticate(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'admin',
        email: 'test@example.com',
        name: 'Test User'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 if no authorization header', async () => {
      await AuthMiddleware.authenticate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authorization token required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await AuthMiddleware.authenticate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is expired', async () => {
      mockRequest.headers.authorization = 'Bearer expired-token';
      jwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired');
      });

      await AuthMiddleware.authenticate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should authenticate with dev user in dev mode', async () => {
      process.env.ENABLE_DEV_AUTH = 'true';

      await AuthMiddleware.authenticate(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user.userId).toBe('user-demo-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use custom user ID in dev mode', async () => {
      process.env.ENABLE_DEV_AUTH = 'true';
      mockRequest.headers['x-user-id'] = 'custom-dev-user';

      await AuthMiddleware.authenticate(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user.userId).toBe('custom-dev-user');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole middleware', () => {
    it('should allow access for user with required role', () => {
      mockRequest.user = { role: 'admin' };
      const middleware = AuthMiddleware.requireRole(['admin', 'user']);

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for user without required role', () => {
      mockRequest.user = { role: 'viewer' };
      const middleware = AuthMiddleware.requireRole(['admin']);

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access if user is not authenticated', () => {
      const middleware = AuthMiddleware.requireRole(['admin']);

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin middleware', () => {
    it('should allow access for admin user', () => {
      mockRequest.user = { role: 'admin' };

      AuthMiddleware.requireAdmin(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for non-admin user', () => {
      mockRequest.user = { role: 'user' };

      AuthMiddleware.requireAdmin(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth middleware', () => {
    it('should set user if valid token provided', async () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-123',
        role: 'admin'
      };

      mockRequest.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue(mockPayload);

      await AuthMiddleware.optionalAuth(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user if no token provided', async () => {
      await AuthMiddleware.optionalAuth(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user if token is invalid', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await AuthMiddleware.optionalAuth(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    it('should grant all permissions to admin users', () => {
      const adminUser = { role: 'admin', userId: 'user-123', organizationId: 'org-123' };

      expect(AuthMiddleware.hasPermission(adminUser, 'read')).toBe(true);
      expect(AuthMiddleware.hasPermission(adminUser, 'write')).toBe(true);
      expect(AuthMiddleware.hasPermission(adminUser, 'delete')).toBe(true);
      expect(AuthMiddleware.hasPermission(adminUser, 'admin')).toBe(true);
    });

    it('should grant read and write permissions to user role', () => {
      const regularUser = { role: 'user', userId: 'user-123', organizationId: 'org-123' };

      expect(AuthMiddleware.hasPermission(regularUser, 'read')).toBe(true);
      expect(AuthMiddleware.hasPermission(regularUser, 'write')).toBe(true);
      expect(AuthMiddleware.hasPermission(regularUser, 'delete')).toBe(false);
      expect(AuthMiddleware.hasPermission(regularUser, 'admin')).toBe(false);
    });

    it('should grant only read permissions to viewer role', () => {
      const viewerUser = { role: 'viewer', userId: 'user-123', organizationId: 'org-123' };

      expect(AuthMiddleware.hasPermission(viewerUser, 'read')).toBe(true);
      expect(AuthMiddleware.hasPermission(viewerUser, 'write')).toBe(false);
      expect(AuthMiddleware.hasPermission(viewerUser, 'delete')).toBe(false);
      expect(AuthMiddleware.hasPermission(viewerUser, 'admin')).toBe(false);
    });

    it('should grant permissions to resource owner', () => {
      const user = { role: 'viewer', userId: 'user-123', organizationId: 'org-123' };
      const resourceOwner = { ownerType: 'user', ownerId: 'user-123' };

      expect(AuthMiddleware.hasPermission(user, 'read', resourceOwner)).toBe(true);
      expect(AuthMiddleware.hasPermission(user, 'write', resourceOwner)).toBe(true);
      expect(AuthMiddleware.hasPermission(user, 'delete', resourceOwner)).toBe(true);
    });

    it('should grant organization permissions to org members', () => {
      const user = { role: 'user', userId: 'user-123', organizationId: 'org-123' };
      const resourceOwner = { ownerType: 'organization', ownerId: 'org-123' };

      expect(AuthMiddleware.hasPermission(user, 'read', resourceOwner)).toBe(true);
      expect(AuthMiddleware.hasPermission(user, 'write', resourceOwner)).toBe(true);
      expect(AuthMiddleware.hasPermission(user, 'admin', resourceOwner)).toBe(false);
    });
  });

  describe('generateIAMTags', () => {
    it('should generate correct IAM tags', () => {
      const userContext = {
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'admin',
        email: 'test@example.com',
        name: 'Test User'
      };

      const tags = AuthMiddleware.generateIAMTags(userContext);

      expect(tags).toEqual({
        'UserId': 'user-123',
        'OrganizationId': 'org-123',
        'OrganizationRole': 'admin',
        'Environment': 'test'
      });
    });
  });
});