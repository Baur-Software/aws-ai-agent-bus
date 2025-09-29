// AWS Cognito Authentication Service
// Modern implementation using AWS SDK v3 and Cognito Identity Provider

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  GetUserCommand,
  UpdateUserAttributesCommand,
  GlobalSignOutCommand,
  AuthFlowType,
  ChallengeNameType,
  RespondToAuthChallengeCommand
} from '@aws-sdk/client-cognito-identity-provider';

export interface CognitoConfig {
  userPoolId: string;
  userPoolClientId: string;
  region: string;
  identityPoolId?: string;
  domain?: string;
  redirectSignIn?: string;
  redirectSignOut?: string;
  authenticationFlowType?: string;
}

export interface CognitoUser {
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  role?: string;
  emailVerified: boolean;
  attributes: Record<string, string>;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthResult {
  user: CognitoUser;
  tokens: AuthTokens;
  challengeName?: ChallengeNameType;
  challengeParameters?: Record<string, string>;
  session?: string;
}

class CognitoAuthService {
  private client: CognitoIdentityProviderClient;
  private config: CognitoConfig;

  constructor(config: CognitoConfig) {
    this.config = config;
    this.client = new CognitoIdentityProviderClient({
      region: config.region,
    });
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.config.userPoolClientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await this.client.send(command);

      if (response.ChallengeName) {
        // Handle challenges (MFA, password change, etc.)
        return {
          user: null as any, // Will be populated after challenge completion
          tokens: null as any,
          challengeName: response.ChallengeName,
          challengeParameters: response.ChallengeParameters,
          session: response.Session,
        };
      }

      if (!response.AuthenticationResult) {
        throw new Error('Authentication failed - no result returned');
      }

      // Get user details
      const user = await this.getCurrentUser(response.AuthenticationResult.AccessToken!);

      const tokens: AuthTokens = {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
        refreshToken: response.AuthenticationResult.RefreshToken!,
        tokenType: response.AuthenticationResult.TokenType || 'Bearer',
        expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
      };

      return { user, tokens };
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Sign up new user
   */
  async signUp(email: string, password: string, name: string, organizationId?: string): Promise<{ userSub: string; codeDeliveryDetails?: any }> {
    try {
      const userAttributes = [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
      ];

      if (organizationId) {
        userAttributes.push({ Name: 'custom:organization_id', Value: organizationId });
      }

      const command = new SignUpCommand({
        ClientId: this.config.userPoolClientId,
        Username: email,
        Password: password,
        UserAttributes: userAttributes,
      });

      const response = await this.client.send(command);

      return {
        userSub: response.UserSub!,
        codeDeliveryDetails: response.CodeDeliveryDetails,
      };
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Confirm sign up with verification code
   */
  async confirmSignUp(email: string, confirmationCode: string): Promise<void> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: this.config.userPoolClientId,
        Username: email,
        ConfirmationCode: confirmationCode,
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('Confirm sign up error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Resend confirmation code
   */
  async resendConfirmationCode(email: string): Promise<any> {
    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: this.config.userPoolClientId,
        Username: email,
      });

      const response = await this.client.send(command);
      return response.CodeDeliveryDetails;
    } catch (error: any) {
      console.error('Resend confirmation code error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(email: string): Promise<any> {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: this.config.userPoolClientId,
        Username: email,
      });

      const response = await this.client.send(command);
      return response.CodeDeliveryDetails;
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Confirm forgot password with new password
   */
  async confirmForgotPassword(email: string, confirmationCode: string, newPassword: string): Promise<void> {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.config.userPoolClientId,
        Username: email,
        ConfirmationCode: confirmationCode,
        Password: newPassword,
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('Confirm forgot password error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(accessToken: string, previousPassword: string, proposedPassword: string): Promise<void> {
    try {
      const command = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: previousPassword,
        ProposedPassword: proposedPassword,
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('Change password error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Get current user details
   */
  async getCurrentUser(accessToken: string): Promise<CognitoUser> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);

      const attributes: Record<string, string> = {};
      response.UserAttributes?.forEach(attr => {
        if (attr.Name && attr.Value) {
          attributes[attr.Name] = attr.Value;
        }
      });

      return {
        userId: response.Username!,
        email: attributes.email || '',
        name: attributes.name || '',
        organizationId: attributes['custom:organization_id'],
        role: attributes['custom:role'] || 'user',
        emailVerified: attributes.email_verified === 'true',
        attributes,
      };
    } catch (error: any) {
      console.error('Get current user error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Update user attributes
   */
  async updateUserAttributes(accessToken: string, attributes: Record<string, string>): Promise<void> {
    try {
      const userAttributes = Object.entries(attributes).map(([name, value]) => ({
        Name: name,
        Value: value,
      }));

      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: userAttributes,
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('Update user attributes error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Sign out user globally
   */
  async globalSignOut(accessToken: string): Promise<void> {
    try {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken,
      });

      await this.client.send(command);
    } catch (error: any) {
      console.error('Global sign out error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.config.userPoolClientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await this.client.send(command);

      if (!response.AuthenticationResult) {
        throw new Error('Failed to refresh token');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
        refreshToken: refreshToken, // Refresh token doesn't change
        tokenType: response.AuthenticationResult.TokenType || 'Bearer',
        expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
      };
    } catch (error: any) {
      console.error('Refresh token error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Respond to auth challenge (MFA, etc.)
   */
  async respondToAuthChallenge(
    challengeName: ChallengeNameType,
    challengeResponses: Record<string, string>,
    session: string
  ): Promise<AuthResult> {
    try {
      const command = new RespondToAuthChallengeCommand({
        ClientId: this.config.userPoolClientId,
        ChallengeName: challengeName,
        ChallengeResponses: challengeResponses,
        Session: session,
      });

      const response = await this.client.send(command);

      if (response.ChallengeName) {
        return {
          user: null as any,
          tokens: null as any,
          challengeName: response.ChallengeName,
          challengeParameters: response.ChallengeParameters,
          session: response.Session,
        };
      }

      if (!response.AuthenticationResult) {
        throw new Error('Challenge response failed');
      }

      const user = await this.getCurrentUser(response.AuthenticationResult.AccessToken!);

      const tokens: AuthTokens = {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
        refreshToken: response.AuthenticationResult.RefreshToken!,
        tokenType: response.AuthenticationResult.TokenType || 'Bearer',
        expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
      };

      return { user, tokens };
    } catch (error: any) {
      console.error('Respond to auth challenge error:', error);
      throw new Error(this.parseAuthError(error));
    }
  }

  /**
   * Parse AWS Cognito errors into user-friendly messages
   */
  private parseAuthError(error: any): string {
    if (!error.name) {
      return error.message || 'An unexpected error occurred';
    }

    switch (error.name) {
      case 'UserNotConfirmedException':
        return 'Please check your email and confirm your account before signing in';
      case 'NotAuthorizedException':
        return 'Invalid email or password';
      case 'UserNotFoundException':
        return 'No account found with this email address';
      case 'InvalidPasswordException':
        return 'Password does not meet requirements';
      case 'UsernameExistsException':
        return 'An account with this email already exists';
      case 'InvalidParameterException':
        return 'Invalid parameters provided';
      case 'CodeMismatchException':
        return 'Invalid verification code';
      case 'ExpiredCodeException':
        return 'Verification code has expired';
      case 'LimitExceededException':
        return 'Too many attempts. Please try again later';
      case 'TooManyRequestsException':
        return 'Too many requests. Please wait a moment and try again';
      case 'PasswordResetRequiredException':
        return 'Password reset is required';
      case 'UserLambdaValidationException':
        return 'User validation failed';
      case 'InvalidUserPoolConfigurationException':
        return 'Authentication service configuration error';
      case 'InternalErrorException':
        return 'An internal error occurred. Please try again';
      default:
        return error.message || 'Authentication failed';
    }
  }

  /**
   * Check if tokens are expired
   */
  isTokenExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt * 1000;
  }

  /**
   * Get hosted UI URL for OAuth flows
   */
  getHostedUIUrl(responseType: 'code' | 'token' = 'code'): string | null {
    if (!this.config.domain || !this.config.redirectSignIn) {
      return null;
    }

    const params = new URLSearchParams({
      response_type: responseType,
      client_id: this.config.userPoolClientId,
      redirect_uri: this.config.redirectSignIn,
      scope: 'phone email openid profile aws.cognito.signin.user.admin',
    });

    return `https://${this.config.domain}.auth.${this.config.region}.amazoncognito.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Get sign out URL for hosted UI
   */
  getSignOutUrl(): string | null {
    if (!this.config.domain || !this.config.redirectSignOut) {
      return null;
    }

    const params = new URLSearchParams({
      client_id: this.config.userPoolClientId,
      logout_uri: this.config.redirectSignOut,
    });

    return `https://${this.config.domain}.auth.${this.config.region}.amazoncognito.com/logout?${params.toString()}`;
  }
}

export default CognitoAuthService;