import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Set up environment BEFORE importing AuthService
// These must be set before the module is loaded since initializeDemoUsers() runs at import time
process.env.ENABLE_DEMO_USER = 'true';
process.env.DEMO_USER_PASSWORD_HASH = '$2b$10$xyz1234567890abcdefghijklmnopqrstuvwxyzABCDEFGH';
process.env.NODE_ENV = 'test';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn()
  }
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn()
  }
}));

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({
    send: vi.fn()
  }))
}));

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn(() => ({
    send: vi.fn()
  }))
}));

describe('Auth Routes', () => {
  let app;
  let setupAuthRoutes;
  let AuthService;
  let bcrypt;
  let jwt;

  beforeAll(async () => {
    // Import mocked modules
    bcrypt = (await import('bcrypt')).default;
    jwt = (await import('jsonwebtoken')).default;

    // Import modules after mocking
    const authModule = await import('../../src/routes/authRoutes');
    setupAuthRoutes = authModule.setupAuthRoutes;
    AuthService = authModule.AuthService;

    // Setup Express app
    app = express();
    app.use(express.json());
    const mockDynamoDBClient = { send: vi.fn() };
    const mockEventBridgeClient = { send: vi.fn() };
    app.use('/api/auth', setupAuthRoutes({
      dynamodb: mockDynamoDBClient,
      eventBridge: mockEventBridgeClient
    }));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment for each test
    process.env.ENABLE_DEV_AUTH = 'false';
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

      vi.spyOn(AuthService, 'authenticateUser').mockResolvedValue(mockUser);
      vi.spyOn(AuthService, 'getUserOrganizations').mockResolvedValue([]);
      vi.spyOn(AuthService, 'getOrganization').mockResolvedValue(null);

      // Mock JWT generation
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
      vi.spyOn(AuthService, 'authenticateUser').mockResolvedValue(null);

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

      vi.spyOn(AuthService, 'createUser').mockResolvedValue(mockUser);
      vi.spyOn(AuthService, 'getUserOrganizations').mockResolvedValue([]);
      vi.spyOn(AuthService, 'getOrganization').mockResolvedValue(null);

      // Mock JWT generation
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
      vi.spyOn(AuthService, 'createUser').mockRejectedValue(new Error('User already exists'));

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
      // Note: These tests depend on demo user being initialized which requires
      // ENABLE_DEMO_USER and DEMO_USER_PASSWORD_HASH env vars set before module load.
      // In CI, these may not be set, so we test the logic paths instead.
      it('should authenticate user with correct password when demo user exists', async () => {
        // Create a new user first to ensure we have a user to test with
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        bcrypt.compare.mockResolvedValue(true);

        const newUser = await AuthService.createUser('auth-test@example.com', 'password123', 'Auth Test');

        const result = await AuthService.authenticateUser('auth-test@example.com', 'password');

        expect(result).toBeDefined();
        expect(result.email).toBe('auth-test@example.com');
        expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashed-password-123');
      });

      it('should return null for incorrect password', async () => {
        bcrypt.hash.mockResolvedValue('hashed-password');
        bcrypt.compare.mockResolvedValue(false);

        // Create user first
        await AuthService.createUser('auth-test-2@example.com', 'password123', 'Auth Test 2').catch(() => {});

        const result = await AuthService.authenticateUser('auth-test-2@example.com', 'wrongpassword');

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
        // First create a user
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        await AuthService.createUser('duplicate-test@example.com', 'password123', 'First User').catch(() => {});

        // Try to create another with same email
        await expect(
          AuthService.createUser('duplicate-test@example.com', 'password123', 'Duplicate User')
        ).rejects.toThrow('User already exists');
      });
    });

    describe('getUser', () => {
      it('should return user by ID', async () => {
        // Create a user first
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        const createdUser = await AuthService.createUser('getuser-test@example.com', 'password123', 'Get User Test');

        const user = await AuthService.getUser(createdUser.id);

        expect(user).toBeDefined();
        expect(user.id).toBe(createdUser.id);
        expect(user.email).toBe('getuser-test@example.com');
      });

      it('should return null for non-existent user', async () => {
        const user = await AuthService.getUser('non-existent');

        expect(user).toBeNull();
      });
    });

    describe('getUserByEmail', () => {
      it('should return user by email', async () => {
        // Create a user first
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        await AuthService.createUser('getbyemail-test@example.com', 'password123', 'Email Test');

        const user = await AuthService.getUserByEmail('getbyemail-test@example.com');

        expect(user).toBeDefined();
        expect(user.email).toBe('getbyemail-test@example.com');
      });

      it('should return null for non-existent email', async () => {
        const user = await AuthService.getUserByEmail('nonexistent@example.com');

        expect(user).toBeNull();
      });
    });

    describe('switchUserOrganization', () => {
      it('should switch user organization successfully', async () => {
        // Create a user and a second org
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        const user = await AuthService.createUser('switch-org-test@example.com', 'password123', 'Switch Org Test');
        const newOrg = await AuthService.createOrganization(user.id, 'Second Org', 'Second org for testing');

        const success = await AuthService.switchUserOrganization(user.id, newOrg.id);

        expect(success).toBe(true);
      });

      it('should fail for invalid organization', async () => {
        // Create a user
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        const user = await AuthService.createUser('switch-org-fail@example.com', 'password123', 'Switch Org Fail Test').catch(() => ({ id: 'test-user' }));

        const success = await AuthService.switchUserOrganization(user.id, 'invalid-org');

        expect(success).toBe(false);
      });

      it('should fail for non-existent user', async () => {
        const success = await AuthService.switchUserOrganization('non-existent', 'org-personal-123');

        expect(success).toBe(false);
      });
    });

    describe('createOrganization', () => {
      it('should create new organization', async () => {
        // Create a user first
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        const user = await AuthService.createUser('create-org-test@example.com', 'password123', 'Create Org Test');

        const org = await AuthService.createOrganization(user.id, 'Test Org', 'Test description');

        expect(org).toBeDefined();
        expect(org.name).toBe('Test Org');
        expect(org.description).toBe('Test description');
        expect(org.ownerId).toBe(user.id);
        expect(org.type).toBe('shared');
      });
    });

    describe('getUserOrganizations', () => {
      it('should return user organizations', async () => {
        // Create a user (which creates a personal org) and add another org
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        const user = await AuthService.createUser('get-orgs-test@example.com', 'password123', 'Get Orgs Test');
        await AuthService.createOrganization(user.id, 'Additional Org', 'Additional org for testing');

        const orgs = await AuthService.getUserOrganizations(user.id);

        // Should have personal org + additional org = 2
        expect(orgs).toHaveLength(2);
      });

      it('should return empty array for non-existent user', async () => {
        const orgs = await AuthService.getUserOrganizations('non-existent');

        expect(orgs).toHaveLength(0);
      });
    });

    describe('getOrganization', () => {
      it('should return organization by ID', async () => {
        // Create a user and org first
        bcrypt.hash.mockResolvedValue('hashed-password-123');
        const user = await AuthService.createUser('get-org-test@example.com', 'password123', 'Get Org Test');
        const createdOrg = await AuthService.createOrganization(user.id, 'Find Me Org', 'Org to find');

        const org = await AuthService.getOrganization(createdOrg.id);

        expect(org).toBeDefined();
        expect(org.id).toBe(createdOrg.id);
        expect(org.name).toBe('Find Me Org');
      });

      it('should return null for non-existent organization', async () => {
        const org = await AuthService.getOrganization('non-existent');

        expect(org).toBeNull();
      });
    });
  });
});