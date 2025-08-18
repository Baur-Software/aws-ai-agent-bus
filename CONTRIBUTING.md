# Contributing to Agent Mesh MCP Server

Thank you for your interest in contributing to the Agent Mesh MCP Server! This document provides guidelines for contributing to the project.

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to maintain a welcoming environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 18+
- AWS CLI configured for testing
- Git

### Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/agent-mesh-mcp-server.git
   cd agent-mesh-mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment**:
   ```bash
   cp .env.example .env
   # Configure your AWS resources for testing
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/tool-name` - New features
- `fix/issue-description` - Bug fixes
- `docs/update-readme` - Documentation updates
- `refactor/component-name` - Code refactoring

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Follow the existing code style
   - Add appropriate error handling
   - Update documentation if needed

3. **Test your changes**:
   ```bash
   # Test with the test server
   node test-server.js
   
   # Test both implementations
   npm run dev
   npm run dev:http
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new tool for X functionality"
   ```

## Code Style Guidelines

### JavaScript Style

- Use ES6+ features and modules
- Use `const` for constants, `let` for variables
- Use async/await for asynchronous code
- Include JSDoc comments for functions
- Handle errors gracefully with try/catch blocks

### Example Function Structure

```javascript
/**
 * Handles retrieval of artifacts from S3
 * @param {Object} params - Parameters object
 * @param {string} params.key - Artifact key to retrieve
 * @returns {Promise<Object>} MCP response object
 */
async handleArtifactsGet({ key }) {
  try {
    const command = new GetObjectCommand({
      Bucket: AGENT_MESH_CONFIG.artifactsBucket,
      Key: key
    });
    
    const response = await s3.send(command);
    const content = await response.Body.transformToString();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          key,
          content,
          content_type: response.ContentType,
          size: response.ContentLength
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error retrieving artifact "${key}": ${error.message}`
      }],
      isError: true
    };
  }
}
```

### MCP Tool Registration

When adding new tools, follow this pattern:

```javascript
// In server.js - traditional MCP style
{
  name: 'tool_name',
  description: 'Clear description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' },
      param2: { type: 'number', description: 'Optional param', default: 10 }
    },
    required: ['param1']
  }
}

// In http-server.js - modern MCP style with Zod
server.registerTool(
  'tool_name',
  {
    title: 'Tool Display Name',
    description: 'Clear description of what the tool does',
    inputSchema: {
      param1: z.string().describe('Parameter description'),
      param2: z.number().optional().default(10).describe('Optional param')
    }
  },
  async ({ param1, param2 }) => {
    // Implementation
  }
);
```

## Testing

### Manual Testing

1. **Test with MCP clients**:
   - Configure the server in Claude Desktop or other MCP clients
   - Test all tools with various inputs
   - Verify error handling

2. **Test HTTP server**:
   ```bash
   curl -X GET http://localhost:3000/health
   ```

3. **Test individual tools**:
   Use the test server to verify basic MCP protocol functionality.

### AWS Testing

- Use separate AWS resources for development/testing
- Test with minimal IAM permissions to ensure security
- Verify all error conditions (missing resources, permissions, etc.)

## Submitting Changes

### Pull Request Process

1. **Ensure your changes are ready**:
   - [ ] Code follows style guidelines
   - [ ] All tests pass
   - [ ] Documentation is updated
   - [ ] Error handling is comprehensive

2. **Create a pull request**:
   - Use a clear, descriptive title
   - Explain what changes were made and why
   - Reference any related issues
   - Include screenshots for UI changes

3. **Pull request template**:
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Refactoring
   
   ## Testing
   - [ ] Tested manually with MCP client
   - [ ] Tested error conditions
   - [ ] Verified AWS permissions
   
   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   ```

### Review Process

- Pull requests require review before merging
- Address all feedback constructively
- Be prepared to make adjustments based on review comments

## Adding New Tools

### Planning

1. **Define the tool's purpose**: What AWS service or functionality will it interact with?
2. **Design the interface**: What parameters are needed? What should the response format be?
3. **Consider security**: What AWS permissions are required? How to handle sensitive data?

### Implementation Steps

1. **Add AWS SDK clients** (if needed):
   ```javascript
   import { NewServiceClient } from '@aws-sdk/client-new-service';
   const newService = new NewServiceClient(awsConfig);
   ```

2. **Implement the handler**:
   - Add comprehensive error handling
   - Follow existing patterns for response formatting
   - Validate input parameters

3. **Register the tool** in both server implementations:
   - Add to `ListToolsRequestSchema` handler in `server.js`
   - Use `registerTool` in `http-server.js`

4. **Update documentation**:
   - Add tool description to README.md
   - Include examples of usage
   - Document required AWS permissions

5. **Test thoroughly**:
   - Test happy path scenarios
   - Test error conditions
   - Verify AWS integration

## Bug Reports

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, AWS region, etc.)
- Error messages and logs
- AWS resource configuration (sanitized)

## Feature Requests

For new features:

- Explain the use case and benefit
- Describe the proposed solution
- Consider AWS service limitations and costs
- Discuss security implications

## Security Considerations

- Never commit AWS credentials or sensitive data
- Follow AWS security best practices
- Use least-privilege IAM permissions
- Validate and sanitize all inputs
- Handle errors without exposing sensitive information

## Documentation

- Update README.md for new features
- Include code comments for complex logic
- Provide usage examples
- Update environment variable documentation

## Questions?

Feel free to open an issue for questions about:
- Project architecture
- AWS integration patterns
- MCP protocol implementation
- Development setup

Thank you for contributing!