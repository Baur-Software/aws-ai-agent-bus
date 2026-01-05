# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < main  | :x:                |

We only provide security updates for the latest version on the `main` branch.

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report security issues via one of these methods:

1. **GitHub Security Advisories** (Preferred): Use the "Report a vulnerability" feature in the Security tab of this repository.
2. **Email**: Send details to the repository maintainers (check the repository's contact information).

### What to Include

When reporting a vulnerability, please provide:

1. **Description**: Clear explanation of the vulnerability
2. **Affected Components**: Which parts of the system are affected (e.g., dashboard-server, mcp-rust, dashboard-ui, infrastructure)
3. **Reproduction Steps**: Detailed steps to reproduce the issue
4. **Impact Assessment**: Potential impact if exploited
5. **Suggested Fix**: If you have ideas for remediation
6. **Environment**: Relevant environment details (OS, versions, etc.)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Depends on severity (see below)

### Severity Levels

| Severity | Description | Resolution Target |
|----------|-------------|-------------------|
| Critical | Active exploitation, data breach, or system compromise | 24-48 hours |
| High | Significant security impact, exploitation possible | 7 days |
| Medium | Moderate impact, limited exploitation | 30 days |
| Low | Minimal impact, defense-in-depth improvement | 90 days |

## Security Best Practices

### For Contributors

1. **Never commit secrets**: API keys, passwords, credentials, or tokens should never appear in code
2. **Use environment variables**: All sensitive configuration via environment variables or AWS Secrets Manager
3. **Follow least privilege**: Request only necessary AWS IAM permissions
4. **Keep dependencies updated**: Regularly update npm and cargo dependencies
5. **Write tests**: Security-related code should have comprehensive test coverage

### For Deployers

1. **Use HTTPS**: Always deploy with TLS certificates for all endpoints
2. **Restrict network access**: Use proper security groups, avoid `0.0.0.0/0` ingress
3. **Enable logging**: Configure CloudWatch logs for audit trails
4. **Rotate credentials**: Regularly rotate JWT secrets and AWS credentials
5. **Monitor alerts**: Set up CloudWatch alarms for suspicious activity

## Security Features

This project implements several security measures:

### Authentication & Authorization
- JWT-based authentication with configurable secrets
- Role-based access control (RBAC) in MCP server
- Multi-tenant isolation with tenant-aware data access

### Data Protection
- Credentials stored in AWS Secrets Manager (not DynamoDB)
- Encrypted artifact storage in S3
- Session management with automatic cleanup

### Infrastructure Security
- Terraform modules follow AWS security best practices
- Security groups restrict ingress to necessary ports
- VPC isolation for ECS services

### Application Security
- Input validation on all API endpoints
- Rate limiting per tenant session
- CORS configuration for web security
- Content Security Policy headers

## Known Security Considerations

### Development Mode
In development mode, some security features may be relaxed for convenience:
- Demo user authentication for local testing
- Localhost URLs without TLS
- Debug logging that may expose sensitive data

**Never use development configurations in production.**

### Multi-Tenant Isolation
The MCP server implements tenant isolation at the application level. For higher security requirements, consider:
- Separate AWS accounts per tenant
- Dedicated infrastructure per tenant
- Additional network isolation

## Security Changelog

### 2026-01
- Implemented event rule actions with proper authentication
- Enhanced multi-agent security hardening
- Added SNS integration for security notifications
- Fixed hardcoded JWT secret fallback issues
- Improved security group configurations

---

For general questions about security, please open a GitHub Discussion rather than an issue.
