# Contributing to SSH MCP Server

Thank you for your interest in contributing to the SSH MCP Server project!

## Project Ownership

**Copyright Holder**: XNet Inc.  
**Project Lead**: Joshua S. Doucette  
**Organization**: XNet NGO  
**Website**: https://xnet.ngo  
**Repository**: https://github.com/XNet-NGO/ssh-mcp-server

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and professional in all interactions.

## How to Contribute

### Reporting Issues

1. Check existing issues to avoid duplicates
2. Use the issue template if provided
3. Include detailed information:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details (OS, Node version, etc.)
   - Relevant logs or error messages

### Submitting Pull Requests

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**:
   - Follow the coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed
4. **Test your changes**:
   ```bash
   npm test
   npm run lint
   ```
5. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Reference issue numbers if applicable
6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**:
   - Provide a clear description of changes
   - Link to related issues
   - Ensure all CI checks pass

### Coding Standards

- **Language**: TypeScript
- **Style**: Follow existing code style
- **Formatting**: Use Prettier (run `npm run format`)
- **Linting**: Use ESLint (run `npm run lint`)
- **Testing**: Write tests for new features
- **Documentation**: Update docs for API changes

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/XNet-NGO/ssh-mcp-server.git
   cd ssh-mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Run in development mode**:
   ```bash
   npm run dev
   ```

### Project Structure

```
ssh-mcp-server/
├── src/
│   ├── core/           # Core functionality
│   ├── tools/          # MCP tool implementations
│   ├── mcp/            # MCP server setup
│   ├── server.ts       # Main server entry point
│   └── index.ts        # Package exports
├── tests/              # Test files
├── docs/               # Documentation
├── dist/               # Compiled output
└── Dockerfile.ssh      # Docker image
```

### Testing Guidelines

- Write unit tests for all new functions
- Write integration tests for tool implementations
- Aim for >80% code coverage
- Test both success and error cases
- Use property-based testing where appropriate

### Documentation Guidelines

- Update README.md for user-facing changes
- Update USAGE_GUIDE.md for new features
- Update docs/AI_USAGE_GUIDE.md for AI assistant usage
- Add JSDoc comments to public APIs
- Include code examples in documentation

## Contributor License Agreement

By contributing to this project, you agree that:

1. Your contributions will be licensed under the MIT License
2. You have the right to submit the contributions
3. You grant XNet Inc. and Joshua S. Doucette a perpetual, worldwide, non-exclusive, royalty-free license to use, modify, and distribute your contributions
4. You retain copyright to your contributions

## Attribution

All contributors will be acknowledged in:
- The project's CONTRIBUTORS.md file
- Release notes for significant contributions
- The project's README.md (for major contributions)

## Questions?

If you have questions about contributing, please:
- Open a discussion on GitHub
- Contact us at: contact@xnet.ngo
- Visit our website: https://xnet.ngo

## Recognition

We value all contributions, whether they are:
- Code improvements
- Bug fixes
- Documentation updates
- Feature suggestions
- Bug reports
- Community support

Thank you for helping make SSH MCP Server better!

---

**Project**: SSH MCP Server  
**Copyright**: © 2026 XNet Inc., Joshua S. Doucette  
**License**: MIT  
**Website**: https://xnet.ngo
