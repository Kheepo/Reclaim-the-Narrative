# Contributing to GBV Reporting Platform

We welcome contributions to the GBV Reporting Platform! This document provides guidelines for contributing to this important project.

## Code of Conduct

This project is dedicated to providing a safe, inclusive environment for everyone. We do not tolerate harassment or discrimination of any kind.

## How to Contribute

### Reporting Issues

1. **Security Issues**: If you discover a security vulnerability, please email us privately instead of opening a public issue.
2. **Bug Reports**: Use the GitHub issue tracker to report bugs. Include:
   - Clear description of the issue
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, browser, Node.js version)

### Feature Requests

1. Check existing issues to avoid duplicates
2. Clearly describe the feature and its benefits
3. Consider the impact on user privacy and security

### Pull Requests

1. **Fork the repository** and create a feature branch
2. **Follow coding standards**:
   - Use TypeScript for type safety
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Commit Guidelines**:
   - Use clear, descriptive commit messages
   - Reference issue numbers when applicable
   - Keep commits focused and atomic

4. **Testing Requirements**:
   - All tests must pass
   - Add tests for new features
   - Maintain or improve code coverage
   - Test both frontend and smart contract components

## Development Setup

1. **Prerequisites**:
   - Node.js (v18 or higher)
   - npm or yarn
   - Git

2. **Setup**:
   ```bash
   git clone <your-fork>
   cd gbv-reporting-platform
   npm install
   ```

3. **Environment**:
   - Copy `.env.example` to `.env.local`
   - Configure necessary environment variables
   - Never commit actual API keys or secrets

4. **Running Tests**:
   ```bash
   npm test                    # All tests
   npx hardhat test           # Smart contract tests
   npm run test:frontend      # Frontend tests
   ```

## Coding Standards

### TypeScript
- Use strict TypeScript configuration
- Define proper types for all functions and variables
- Avoid `any` type unless absolutely necessary

### React Components
- Use functional components with hooks
- Keep components small and focused
- Use proper prop types
- Follow accessibility guidelines

### Smart Contracts
- Follow Solidity best practices
- Include comprehensive tests
- Document all functions
- Consider gas optimization

### Security Guidelines

1. **Never commit**:
   - Private keys
   - API keys
   - Passwords
   - Personal information

2. **Input Validation**:
   - Validate all user inputs
   - Sanitize data before processing
   - Use proper encryption for sensitive data

3. **Smart Contract Security**:
   - Follow established patterns
   - Avoid common vulnerabilities
   - Include proper access controls

## Documentation

- Update README.md for significant changes
- Document new features and APIs
- Include code comments for complex logic
- Update type definitions

## Review Process

1. **Automated Checks**:
   - All tests must pass
   - Code must pass linting
   - No security vulnerabilities

2. **Manual Review**:
   - Code quality and style
   - Security considerations
   - Documentation completeness
   - Test coverage

3. **Approval**:
   - At least one maintainer approval required
   - All feedback addressed
   - CI/CD pipeline passes

## Release Process

1. Version bumping follows semantic versioning
2. Changelog updated for each release
3. Security patches prioritized
4. Breaking changes clearly documented

## Getting Help

- Check existing documentation
- Search closed issues
- Ask questions in discussions
- Contact maintainers for sensitive issues

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes for significant contributions
- Project documentation

## Legal

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

**Important**: This platform deals with sensitive information related to gender-based violence. All contributors must approach this work with appropriate sensitivity, respect, and commitment to user safety and privacy.

Thank you for contributing to this important cause!