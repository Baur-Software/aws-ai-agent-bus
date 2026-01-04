# Contributing to AWS AI Agent Bus

Thank you for your interest in contributing to the AWS AI Agent Bus project! This guide will help you get started with contributing code, documentation, and bug reports.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Commit Guidelines](#commit-guidelines)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

This project follows a standard code of conduct. Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

### Prerequisites

- **Node.js** 18+ (for dashboard-server and dashboard-ui)
- **Rust** 1.70+ (for mcp-rust server)
- **Terraform** 1.0+ (for infrastructure)
- **AWS CLI** configured with appropriate credentials
- **Git** for version control
- **bun** (optional, for faster local development)

### Repository Structure

```
aws-ai-agent-bus/
├── mcp-rust/           # Rust MCP server implementation
├── dashboard-server/   # WebSocket API gateway (Node.js)
├── dashboard-ui/       # SolidJS frontend
├── infra/             # Terraform infrastructure modules
├── docs/              # Project documentation
└── .claude/           # Agent system definitions
```

## Development Setup

### 1. Clone the Repository

```bash
git clone git@github.com:Baur-Software/aws-ai-agent-bus.git
cd aws-ai-agent-bus
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install workspace dependencies
npm run install:all

# Or install individual workspaces
cd dashboard-server && npm install
cd ../dashboard-ui && npm install
```

### 3. Set Up Environment Variables

```bash
# Copy example environment files
cp dashboard-ui/.env.example dashboard-ui/.env

# Configure AWS credentials
export AWS_PROFILE=your-profile
export AWS_REGION=us-west-2
```

### 4. Start Development Servers

```bash
# Start both dashboard-server and dashboard-ui
npm run dev:all

# Or start individually using bun (recommended for local dev)
cd dashboard-server && bun run dev
cd dashboard-ui && bun run dev
```

### 5. MCP Rust Server Development

```bash
cd mcp-rust
cargo build
cargo test
cargo run  # Starts MCP server on stdio
```

## Making Changes

### Branch Naming Convention

Use descriptive branch names following this pattern:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions or fixes

Example: `feature/add-event-monitoring`, `fix/websocket-reconnection`

### Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature
   ```

2. **Make your changes** following the code standards below

3. **Run tests** to ensure nothing is broken:
   ```bash
   npm run test:all
   ```

4. **Commit your changes** following the commit guidelines

5. **Push and create a PR**:
   ```bash
   git push origin feature/your-feature
   ```

## Testing Requirements

**Critical: 100% test pass rate is required before merging.**

### Running Tests

```bash
# Run all tests
npm run test:all

# Individual workspace tests
npm run server:test    # dashboard-server tests
npm run ui:test        # dashboard-ui tests

# MCP Rust tests
cd mcp-rust && cargo test

# Infrastructure validation
npm run tf:fmt         # Format Terraform files
```

### Test Guidelines

- **Never skip tests** - Skipped tests represent technical debt
- **Write tests for new features** - Cover happy paths and edge cases
- **Update existing tests** - If your changes affect existing behavior
- **Mock external dependencies** - AWS services, APIs, etc.

### Test Debt Tracking

If you must temporarily skip a test, document it in the appropriate `TODO_TESTS.md` file with:
- Reason for skipping
- Expected fix timeline
- Impact assessment

## Pull Request Process

### Before Submitting

1. **All tests pass**: `npm run test:all` shows 100% pass rate
2. **Code is formatted**: Run appropriate formatters
3. **No security vulnerabilities**: Check for common issues (XSS, injection, etc.)
4. **Documentation updated**: Update relevant docs if behavior changes

### PR Template

When creating a PR, include:

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- Describe tests added or modified
- Include test results

## Checklist
- [ ] All tests pass
- [ ] Code follows project standards
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
```

### Review Process

1. PRs require at least one approval before merging
2. Address all review comments
3. Keep PRs focused and reasonably sized
4. Squash commits if requested

## Code Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Modern ES6+ syntax
- Strict type checking enabled
- Use ESLint configurations provided

### Rust

- Follow Rust idioms and conventions
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- Document public APIs

### Terraform

- Always run `npm run tf:fmt` before committing
- Use consistent variable naming
- Document all modules and variables
- Follow workspace tier guidelines (small/medium/large)

### General Principles

- **Keep it simple** - Avoid over-engineering
- **Be explicit** - Clear code over clever code
- **Stay focused** - Only make changes relevant to the task
- **Handle errors** - Graceful degradation with proper logging

## Commit Guidelines

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(events): add SNS integration for event monitoring

fix(dashboard): resolve WebSocket reconnection issue

docs(readme): update installation instructions

test(auth): add unit tests for JWT validation
```

## Issue Reporting

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear, concise description of the bug
2. **Reproduction Steps**: Numbered steps to reproduce
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: OS, Node version, browser, etc.
6. **Screenshots/Logs**: If applicable

### Feature Requests

When requesting features, include:

1. **Problem Statement**: What problem does this solve?
2. **Proposed Solution**: Your suggested approach
3. **Alternatives Considered**: Other solutions you've thought of
4. **Additional Context**: Any other relevant information

## Infrastructure Contributions

### Terraform Guidelines

- Use environment-driven configuration
- Set `export AWS_PROFILE=baursoftware` (avoid hardcoding)
- Follow workspace tier guidelines:
  - `extra-small`: ~$10/month target
  - `small`: Core services
  - `medium`: ECS agents, Step Functions
  - `large`: Aurora pgvector, analytics

### Deploying Changes

```bash
# Set workspace and environment
export WS=small/kv_store
export ENV=dev

# Plan and apply
npm run tf:plan
npm run tf:apply
```

## Getting Help

- **Documentation**: Check the `docs/` directory
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **CLAUDE.md**: Reference for Claude Code integration

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to AWS AI Agent Bus!
