import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

// Mock AWS SDK clients
const mockDynamoDBClient = {
  send: jest.fn()
};

const mockEventBridgeClient = {
  send: jest.fn()
};

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => mockDynamoDBClient)
}));

jest.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn(() => mockEventBridgeClient)
}));

describe('Auth Routes', () => {
  let app;
  let setupAuthRoutes;
  let AuthService;

  beforeAll(async () => {
    // Import modules after mocking
    const authModule = await import('../../src/routes/authRoutes.js');
    setupAuthRoutes = authModule.setupAuthRoutes;
    AuthService = authModule.AuthService;

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth', setupAuthRoutes({
      dynamodb: mockDynamoDBClient,
      eventBridge: mockEventBridgeClient
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment
    process.env.ENABLE_DEV_AUTH = 'false';
    process.env.NODE_ENV = 'test';
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // Mock successful authentication
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed-password',
        organizations: ['org-123'],
        currentOrganizationId: 'org-123'
      };

      jest.spyOn(AuthService, 'authenticateUser').mockResolvedValue(mockUser);
      jest.spyOn(AuthService, 'getUserOrganizations').mockResolvedValue([]);
      jest.spyOn(AuthService, 'getOrganization').mockResolvedValue(null);

      // Mock JWT generation
      const jwt = await import('jsonwebtoken');
      jwt.sign.mockReturnValue('mock-jwt-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(AuthService.authenticateUser).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should return 401 for invalid credentials', async () => {
      jest.spyOn(AuthService, 'authenticateUser').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 400 for missing email or password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        name: 'New User',
        organizations: ['org-123'],
        currentOrganizationId: 'org-123'
      };

      jest.spyOn(AuthService, 'createUser').mockResolvedValue(mockUser);
      jest.spyOn(AuthService, 'getUserOrganizations').mockResolvedValue([]);
      jest.spyOn(AuthService, 'getOrganization').mockResolvedValue(null);

      // Mock JWT generation
      const jwt = await import('jsonwebtoken');
      jwt.sign.mockReturnValue('mock-jwt-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(AuthService.createUser).toHaveBeenCalledWith('newuser@example.com', 'password123', 'New User');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123', // too short
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password must be at least 6 characters');
    });

    it('should return 409 for existing user', async () => {
      jest.spyOn(AuthService, 'createUser').mockRejectedValue(new Error('User already exists'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'password123',
          name: 'Test User'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User already exists');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com'
          // missing password and name
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email, password, and name are required');
    });
  });

  describe('AuthService', () => {
    describe('authenticateUser', () => {
      it('should authenticate user with correct password', async () => {
        bcrypt.compare.mockResolvedValue(true);

        const result = await AuthService.authenticateUser('demo@example.com', 'password');

        expect(result).toBeDefined();
        expect(result.email).toBe('demo@example.com');
        expect(bcrypt.compare).toHaveBeenCalledWith('password', expect.any(String));
      });

      it('should return null for incorrect password', async () => {
        bcrypt.compare.mockResolvedValue(false);

        const result = await AuthService.authenticateUser('demo@example.com', 'wrongpassword');

        expect(result).toBeNull();
      });

      it('should return null for non-existent user', async () => {
        const result = await AuthService.authenticateUser('nonexistent@example.com', 'password');

        expect(result).toBeNull();
      });
    });

    describe('createUser', () => {
      it('should create new user with hashed password', async () => {
        const hashedPassword = 'hashed-password-123';
        bcrypt.hash.mockResolvedValue(hashedPassword);

        const user = await AuthService.createUser('newuser@example.com', 'password123', 'New User');

        expect(user).toBeDefined();
        expect(user.email).toBe('newuser@example.com');
        expect(user.name).toBe('New User');
        expect(user.passwordHash).toBe(hashedPassword);
        expect(user.organizations).toHaveLength(1);
        expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      });

      it('should throw error for duplicate email', async () => {
        await expect(
          AuthService.createUser('demo@example.com', 'password123', 'Duplicate User')
        ).rejects.toThrow('User already exists');
      });
    });

    describe('getUser', () => {
      it('should return user by ID', async () => {
        const user = await AuthService.getUser('user-demo-123');

        expect(user).toBeDefined();
        expect(user.id).toBe('user-demo-123');
        expect(user.email).toBe('demo@example.com');
      });

      it('should return null for non-existent user', async () => {
        const user = await AuthService.getUser('non-existent');

        expect(user).toBeNull();
      });
    });

    describe('getUserByEmail', () => {
      it('should return user by email', async () => {
        const user = await AuthService.getUserByEmail('demo@example.com');

        expect(user).toBeDefined();
        expect(user.email).toBe('demo@example.com');
      });

      it('should return null for non-existent email', async () => {
        const user = await AuthService.getUserByEmail('nonexistent@example.com');

        expect(user).toBeNull();
      });
    });

    describe('switchUserOrganization', () => {
      it('should switch user organization successfully', async () => {
        const success = await AuthService.switchUserOrganization('user-demo-123', 'org-personal-123');

        expect(success).toBe(true);
      });

      it('should fail for invalid organization', async () => {
        const success = await AuthService.switchUserOrganization('user-demo-123', 'invalid-org');

        expect(success).toBe(false);
      });

      it('should fail for non-existent user', async () => {
        const success = await AuthService.switchUserOrganization('non-existent', 'org-personal-123');

        expect(success).toBe(false);
      });
    });

    describe('createOrganization', () => {
      it('should create new organization', async () => {
        const org = await AuthService.createOrganization('user-demo-123', 'Test Org', 'Test description');

        expect(org).toBeDefined();
        expect(org.name).toBe('Test Org');
        expect(org.description).toBe('Test description');
        expect(org.ownerId).toBe('user-demo-123');
        expect(org.type).toBe('shared');
      });
    });

    describe('getUserOrganizations', () => {
      it('should return user organizations', async () => {
        const orgs = await AuthService.getUserOrganizations('user-demo-123');

        expect(orgs).toHaveLength(2);
        expect(orgs.map(o => o.id)).toContain('org-personal-123');
        expect(orgs.map(o => o.id)).toContain('org-shared-456');
      });

      it('should return empty array for non-existent user', async () => {
        const orgs = await AuthService.getUserOrganizations('non-existent');

        expect(orgs).toHaveLength(0);
      });
    });

    describe('getOrganization', () => {
      it('should return organization by ID', async () => {
        const org = await AuthService.getOrganization('org-personal-123');

        expect(org).toBeDefined();
        expect(org.id).toBe('org-personal-123');
        expect(org.name).toBe('Personal Projects');
      });

      it('should return null for non-existent organization', async () => {
        const org = await AuthService.getOrganization('non-existent');

        expect(org).toBeNull();
      });
    });
  });
});