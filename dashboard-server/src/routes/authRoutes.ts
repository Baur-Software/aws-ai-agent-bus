import { Router, Request, Response } from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import AuthMiddleware, { AuthenticatedRequest } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  passwordHash?: string;
  organizations: string[];
  currentOrganizationId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: 'personal' | 'shared';
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

interface AuthDependencies {
  dynamodb: DynamoDBClient;
  eventBridge: EventBridgeClient;
}

// Mock service for now - will be replaced with real authentication
// NOTE: In production, replace with database-backed user storage
class AuthService {
  private static users: User[] = AuthService.initializeDemoUsers();

  /**
   * Initialize demo users from environment configuration
   * In production, this should be replaced with database queries
   */
  private static initializeDemoUsers(): User[] {
    // Only enable demo user in development mode with explicit opt-in
    if (process.env.NODE_ENV === 'production' || !process.env.ENABLE_DEMO_USER) {
      return [];
    }

    const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@example.com';
    const demoPasswordHash = process.env.DEMO_USER_PASSWORD_HASH;

    if (!demoPasswordHash) {
      console.warn('DEMO_USER_PASSWORD_HASH not set - demo user disabled');
      return [];
    }

    return [{
      id: 'user-demo-123',
      email: demoEmail,
      name: 'Demo User',
      avatar: 'https://via.placeholder.com/40',
      passwordHash: demoPasswordHash,
      organizations: ['org-personal-123', 'org-shared-456'],
      currentOrganizationId: 'org-shared-456',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }];
  }

  private static organizations: Organization[] = [
    {
      id: 'org-personal-123',
      name: 'Personal Projects',
      slug: 'personal',
      description: 'My personal workspace',
      type: 'personal',
      memberCount: 1,
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      ownerId: 'user-demo-123'
    },
    {
      id: 'org-shared-456',
      name: 'Acme Corporation',
      slug: 'acme',
      description: 'Building the future',
      type: 'shared',
      memberCount: 15,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      ownerId: 'user-demo-123'
    }
  ];

  static async getUser(userId: string): Promise<User | null> {
    return this.users.find(user => user.id === userId) || null;
  }

  static async getUserOrganizations(userId: string): Promise<Organization[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    return this.organizations.filter(org =>
      user.organizations.includes(org.id)
    );
  }

  static async getOrganization(orgId: string): Promise<Organization | null> {
    return this.organizations.find(org => org.id === orgId) || null;
  }

  static async switchUserOrganization(userId: string, orgId: string): Promise<boolean> {
    const user = this.users.find(u => u.id === userId);
    if (!user || !user.organizations.includes(orgId)) {
      return false;
    }

    user.currentOrganizationId = orgId;
    user.updatedAt = new Date().toISOString();
    return true;
  }

  static async createOrganization(userId: string, name: string, description?: string): Promise<Organization> {
    const orgId = `org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const newOrg: Organization = {
      id: orgId,
      name,
      slug,
      description,
      type: 'shared',
      memberCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: userId
    };

    this.organizations.push(newOrg);

    // Add org to user's organizations
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.organizations.push(orgId);
      user.updatedAt = new Date().toISOString();
    }

    return newOrg;
  }

  /**
   * Authenticate user credentials
   */
  static async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = this.users.find(u => u.email === email);
    if (!user || !user.passwordHash) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    return isValidPassword ? user : null;
  }

  /**
   * Create a new user account
   */
  static async createUser(email: string, password: string, name: string): Promise<User> {
    // Check if user already exists
    if (this.users.find(u => u.email === email)) {
      throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create personal organization
    const personalOrgId = `org-personal-${Date.now()}`;
    const personalOrg: Organization = {
      id: personalOrgId,
      name: `${name}'s Projects`,
      slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      description: 'Personal workspace',
      type: 'personal',
      memberCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: userId
    };

    this.organizations.push(personalOrg);

    const newUser: User = {
      id: userId,
      email,
      name,
      passwordHash,
      organizations: [personalOrgId],
      currentOrganizationId: personalOrgId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.users.push(newUser);
    return newUser;
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email === email) || null;
  }
}

export function setupAuthRoutes(deps: AuthDependencies): Router {
  const router = Router();

  // Production login endpoint
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await AuthService.authenticateUser(email, password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token with minimal user claims only
      const token = AuthMiddleware.generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        organizationMemberships: [], // Keep empty - orgs fetched from DB
        personalNamespace: `user-${user.id}`,
        organizationId: user.currentOrganizationId || user.organizations[0] || '',
        role: 'admin' // Default role - would come from user permissions in production
      });

      const organizations = await AuthService.getUserOrganizations(user.id);
      const currentOrganization = user.currentOrganizationId
        ? await AuthService.getOrganization(user.currentOrganizationId)
        : null;

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          organizationId: user.currentOrganizationId || user.organizations[0] || '',
          role: 'admin'
        },
        organizations,
        currentOrganization
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Production register endpoint
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Password strength validation
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const user = await AuthService.createUser(email, password, name);

      // Generate JWT token with minimal user claims only
      const token = AuthMiddleware.generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        organizationMemberships: [], // Keep empty - orgs fetched from DB
        personalNamespace: `user-${user.id}`,
        organizationId: user.currentOrganizationId || user.organizations[0] || '',
        role: 'admin'
      });

      const organizations = await AuthService.getUserOrganizations(user.id);
      const currentOrganization = user.currentOrganizationId
        ? await AuthService.getOrganization(user.currentOrganizationId)
        : null;

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          organizationId: user.currentOrganizationId || user.organizations[0] || '',
          role: 'admin'
        },
        organizations,
        currentOrganization
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.message === 'User already exists') {
        res.status(409).json({ error: 'User already exists' });
      } else {
        res.status(500).json({ error: 'Registration failed' });
      }
    }
  });

  // Production logout endpoint
  router.post('/logout', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // In a production system with Redis/DB sessions, you would invalidate the token here
      // For JWT, we rely on client-side token removal and expiration
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Validate token endpoint
  router.get('/validate', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await AuthService.getUser(req.user!.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      const organizations = await AuthService.getUserOrganizations(user.id);
      const currentOrganization = user.currentOrganizationId
        ? await AuthService.getOrganization(user.currentOrganizationId)
        : null;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          organizationId: user.currentOrganizationId || user.organizations[0] || '',
          role: req.user!.role
        },
        organizations,
        currentOrganization
      });
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ error: 'Token validation failed' });
    }
  });

  // Get current user info (authenticated)
  router.get('/me', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await AuthService.getUser(req.user!.userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const organizations = await AuthService.getUserOrganizations(user.id);
      const currentOrganization = user.currentOrganizationId
        ? await AuthService.getOrganization(user.currentOrganizationId)
        : null;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          organizationId: user.currentOrganizationId || user.organizations[0] || '',
          role: req.user!.role
        },
        organizations,
        currentOrganization
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
      res.status(500).json({ error: 'Failed to fetch user info' });
    }
  });

  // Switch organization context
  router.post('/switch-organization', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { organizationId } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const success = await AuthService.switchUserOrganization(req.user!.userId, organizationId);

      if (!success) {
        return res.status(400).json({ error: 'Invalid organization or access denied' });
      }

      const user = await AuthService.getUser(req.user!.userId);
      const newOrganization = await AuthService.getOrganization(organizationId);

      // Generate new token with updated organization context
      const newToken = AuthMiddleware.generateToken({
        userId: req.user!.userId,
        email: req.user!.email!,
        name: req.user!.name!,
        organizationMemberships: [], // Keep empty - orgs fetched from DB
        personalNamespace: `user-${req.user!.userId}`,
        organizationId,
        role: req.user!.role
      });

      // Broadcast context switch event
      const contextSwitchEvent = {
        type: 'organization_switched',
        data: {
          userId: req.user!.userId,
          organizationId,
          organization: newOrganization,
          timestamp: new Date().toISOString()
        }
      };

      // Broadcast to WebSocket clients (if wsBroadcast is available)
      if (req.app.locals.wsBroadcast) {
        req.app.locals.wsBroadcast(contextSwitchEvent);
      }

      res.json({
        success: true,
        token: newToken,
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
          avatar: user?.avatar,
          organizationId,
          role: req.user!.role
        },
        organization: newOrganization
      });
    } catch (error) {
      console.error('Error switching organization:', error);
      res.status(500).json({ error: 'Failed to switch organization' });
    }
  });

  // Create new organization
  router.post('/organizations', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Organization name is required' });
      }

      const newOrganization = await AuthService.createOrganization(req.user!.userId, name, description);

      // Broadcast organization created event
      const orgCreatedEvent = {
        type: 'organization_created',
        data: {
          userId: req.user!.userId,
          organization: newOrganization,
          timestamp: new Date().toISOString()
        }
      };

      if (req.app.locals.wsBroadcast) {
        req.app.locals.wsBroadcast(orgCreatedEvent);
      }

      res.status(201).json(newOrganization);
    } catch (error) {
      console.error('Error creating organization:', error);
      res.status(500).json({ error: 'Failed to create organization' });
    }
  });

  // Get user's organizations
  router.get('/organizations', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizations = await AuthService.getUserOrganizations(req.user!.userId);

      res.json(organizations);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      res.status(500).json({ error: 'Failed to fetch organizations' });
    }
  });

  return router;
}

export { AuthService };