# AWS Cognito Authentication Module
# Provides user pool, app client, and identity pool for modern authentication

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# User Pool for authentication
resource "aws_cognito_user_pool" "agent_mesh" {
  name = "${var.name}-user-pool"

  # Email and username configuration
  alias_attributes = ["email"]
  username_configuration {
    case_sensitive = false
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # User attributes
  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type = "String"
    name                = "name"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # Custom attributes for organization management
  schema {
    attribute_data_type = "String"
    name                = "organization_id"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type = "String"
    name                = "role"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 50
    }
  }

  # Auto-verification
  auto_verified_attributes = ["email"]

  # Verification messages
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Agent Mesh - Verify your email"
    email_message        = "Your verification code is {####}"
  }

  # Device tracking (optional)
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }

  # MFA (optional - can be enabled later)
  mfa_configuration = "OFF"

  # Remove this from main.tf and place in variables.tf:

  variable "tags" {
    description = "A map of tags to assign to resources."
    type        = map(string)
    default     = {}
  }
}

# User Pool Client for web application
resource "aws_cognito_user_pool_client" "agent_mesh_web" {
  name         = "${var.name}-web-client"
  user_pool_id = aws_cognito_user_pool.agent_mesh.id

  # Client settings
  generate_secret = false # For public clients (SPA/mobile)

  # Authentication flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  # Token validity
  access_token_validity  = 1  # 1 hour
  id_token_validity      = 1  # 1 hour
  refresh_token_validity = 30 # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Allowed OAuth flows
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["phone", "email", "openid", "profile", "aws.cognito.signin.user.admin"]

  # Callback URLs (update with your domain)
  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  # Security settings
  prevent_user_existence_errors = "ENABLED"

  # Read and write attributes
  read_attributes = [
    "email",
    "name",
    "email_verified",
    "custom:organization_id",
    "custom:role"
  ]

  write_attributes = [
    "email",
    "name",
    "custom:organization_id",
    "custom:role"
  ]
}

# User Pool Domain for hosted UI
resource "aws_cognito_user_pool_domain" "agent_mesh" {
  count        = var.enable_hosted_ui ? 1 : 0
  domain       = "${var.name}-auth-${random_string.domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.agent_mesh.id
}

# Random string for unique domain
resource "random_string" "domain_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Identity Pool for AWS resource access (optional)
resource "aws_cognito_identity_pool" "agent_mesh" {
  count                            = var.enable_identity_pool ? 1 : 0
  identity_pool_name               = "${var.name}-identity-pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.agent_mesh_web.id
    provider_name           = aws_cognito_user_pool.agent_mesh.endpoint
    server_side_token_check = false
  }

  tags = var.tags
}

# IAM roles for identity pool (if enabled)
resource "aws_iam_role" "authenticated" {
  count = var.enable_identity_pool ? 1 : 0
  name  = "${var.name}-cognito-authenticated-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.agent_mesh[0].id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# Basic policy for authenticated users
resource "aws_iam_role_policy" "authenticated" {
  count = var.enable_identity_pool ? 1 : 0
  name  = "${var.name}-cognito-authenticated-policy"
  role  = aws_iam_role.authenticated[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-sync:*",
          "cognito-identity:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Identity pool role attachment
resource "aws_cognito_identity_pool_roles_attachment" "agent_mesh" {
  count            = var.enable_identity_pool ? 1 : 0
  identity_pool_id = aws_cognito_identity_pool.agent_mesh[0].id

  roles = {
    "authenticated" = aws_iam_role.authenticated[0].arn
  }
}

# Minimal resource so Terraform can read the module
resource "aws_cognito_user_pool" "main" {
  name = "example-user-pool"
}

