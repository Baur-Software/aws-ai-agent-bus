# Agent Creation Guidelines

## Overview

This guide establishes standards for creating effective specialist agents that work cohesively within our agent system. These guidelines ensure consistency, effectiveness, and maintainability across all agents.

## Core Principles

### 1. Token Economy Optimization

- **Front-matter first**: Encode key behaviors in structured YAML front-matter
- **Concise content**: Follow token economy principles - favor compact, reusable patterns
- **Reference over repetition**: Link to shared resources rather than duplicating content
- **Artifact focus**: Generate only requested artifacts, avoid unnecessary explanations

### 2. Specialization Focus

- **Clear domain boundaries**: Each agent should have well-defined expertise areas
- **Deep not broad**: Better to excel in narrow domains than be mediocre across many
- **Context awareness**: Agents should understand their role in larger workflows
- **Handoff protocols**: Clear patterns for delegating to other specialists

### 3. Integration-First Design

- **Delegation patterns**: Define clear triggers and handoff protocols to other agents
- **Communication standards**: Use structured handoff messages for seamless workflows
- **Dependency awareness**: Understand which agents complement your expertise
- **Project adaptation**: Adapt to existing project architectures and conventions

## Agent Structure Template

### Front-matter Requirements

```yaml
---
name: agent-identifier
description: |
  Brief description of agent's core expertise and when to use them.
  
  Examples:
  - <example>
    Context: When this agent should be used
    user: "User request example"
    assistant: "I'll use the [agent-name] to [specific capability]"
    <commentary>
    Why this agent is the right choice
    </commentary>
  </example>
  
  Delegations:
  - <delegation>
    Trigger: When to delegate to another agent
    Target: target-agent-name
    Handoff: "Specific handoff message format"
  </delegation>
---
```

### Content Structure

1. **Agent Identity** (50-100 words)
   - Core expertise statement
   - Specialization boundaries
   - Integration philosophy

2. **Documentation Integration** (Required section)
   - Latest documentation fetching requirements
   - Version-specific considerations
   - API/framework change adaptation

3. **Core Expertise** (Structured list)
   - Primary capabilities
   - Advanced features
   - Integration points
   - Performance considerations

4. **Implementation Patterns** (Code examples)
   - 2-3 comprehensive, real-world examples
   - Modern best practices
   - Common use cases
   - Integration scenarios

5. **Quality Standards** (Measurable criteria)
   - Performance benchmarks
   - Security requirements
   - Accessibility standards
   - Testing requirements

6. **Delegation Protocols** (Structured handoffs)
   - Recognition patterns
   - Target agent identification
   - Handoff message formats
   - Context preservation

## Best Practices

### Examples and Documentation

#### Example Quality Standards

- **Real-world relevance**: Use actual project scenarios, not toy examples
- **Complete implementations**: Show full working code, not fragments
- **Context included**: Explain why this approach was chosen
- **Integration ready**: Examples should be easily adaptable to real projects

#### Documentation Integration

```
## IMPORTANT: Always Use Latest Documentation

Before implementing any [TECHNOLOGY] features, you MUST fetch the latest documentation:

1. **First Priority**: Use WebFetch to get docs from [official-docs-url]
2. **Always verify**: Current API changes, new features, breaking changes
3. **Check compatibility**: Framework version requirements

**Example Usage:**
```

Before implementing this component, I'll fetch the latest docs...
[Use WebFetch to get current patterns and API docs]
Now implementing with current best practices...

```
```

### Delegation Patterns

#### Recognition Triggers

- **Technology keywords**: Specific frameworks, tools, or platforms
- **Complexity indicators**: Advanced patterns requiring specialized knowledge
- **Integration needs**: Backend, frontend, infrastructure coordination
- **Review requirements**: Security, performance, accessibility audits

#### Handoff Message Format

```
## [DOMAIN] Implementation Completed

### Components Delivered
- [List of deliverables with purposes]

### Key Features
- [Functionality implemented]
- [Performance optimizations]
- [Security considerations]

### Integration Points
- [How this connects to existing systems]
- [Dependencies or requirements]

### Next Steps Available
- [Specific agent]: [When and why to delegate]
- [Another agent]: [Complementary capabilities needed]

### Files Modified
- [Absolute file paths with brief descriptions]
```

### Testing and Validation

#### Agent Testing Protocol

1. **Capability verification**: Test core expertise areas
2. **Integration testing**: Verify handoff protocols work
3. **Documentation testing**: Ensure examples are current and functional
4. **Performance validation**: Confirm quality standards are met

#### Quality Metrics

- Response accuracy for domain-specific queries
- Successful delegation to appropriate agents
- Code quality and best practice compliance
- Integration with existing project structures

## Agent Categories

### Core Agents (Universal capabilities)

- **Purpose**: Fundamental development tasks across all projects
- **Examples**: code-reviewer, documentation-specialist, performance-optimizer
- **Characteristics**: Framework-agnostic, broad applicability

### Specialized Agents (Technology-specific)

- **Purpose**: Deep expertise in specific technologies or frameworks
- **Examples**: solidjs-specialist, django-backend-expert, terraform-architect
- **Characteristics**: Deep domain knowledge, current with latest versions

### Universal Agents (Cross-cutting concerns)

- **Purpose**: Common development needs across technologies
- **Examples**: tailwind-css-expert, api-architect, backend-developer
- **Characteristics**: Adaptable patterns, integration-focused

### Service Agents (Platform-specific)

- **Purpose**: Cloud services and external platform integration
- **Examples**: aws-s3-expert, stripe-expert, github-expert
- **Characteristics**: API-focused, service-specific best practices

## Creation Workflow

### 1. Planning Phase

- [ ] Define agent domain and boundaries
- [ ] Identify complementary agents for delegation
- [ ] Research current best practices and documentation
- [ ] Plan example scenarios and use cases

### 2. Implementation Phase

- [ ] Create front-matter with examples and delegations
- [ ] Write core expertise sections
- [ ] Develop comprehensive code examples
- [ ] Define quality standards and testing approaches
- [ ] Document delegation protocols

### 3. Validation Phase

- [ ] Test examples with current framework versions
- [ ] Validate delegation patterns with existing agents
- [ ] Review against token economy principles
- [ ] Ensure integration with project conventions

### 4. Integration Phase

- [ ] Update related agents' delegation patterns
- [ ] Add to agent discovery documentation
- [ ] Test in real project scenarios
- [ ] Gather feedback and iterate

## Common Patterns

### Documentation Fetching

All agents should prioritize getting current documentation:

- Use WebFetch for official documentation
- Check for breaking changes and new features
- Adapt examples to current API versions
- Reference specific version requirements

### Error Handling

- Graceful degradation when services are unavailable
- Clear error messages with next steps
- Fallback to alternative approaches when possible
- Proper logging and debugging information

### Performance Considerations

- Include performance optimization patterns
- Monitor for common performance pitfalls
- Provide benchmarking approaches
- Consider scalability implications

### Security Awareness

- Include security best practices
- Validate input handling approaches
- Consider authentication and authorization
- Address common vulnerabilities

## Maintenance

### Version Updates

- Regular review of framework/technology updates
- Update examples for new API versions
- Refresh delegation patterns as system evolves
- Performance and security audit cycles

### Quality Assurance

- Periodic testing of examples and patterns
- Validation of delegation handoffs
- Review of integration effectiveness
- User feedback incorporation

### Evolution

- Monitor for new capabilities to add
- Identify redundancies to consolidate
- Adapt to changing development practices
- Expand into adjacent domains when appropriate

---

Following these guidelines ensures our agents provide maximum value while maintaining consistency and enabling powerful delegation workflows across complex development tasks.
