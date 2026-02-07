# Contributing to LineCount

Thank you for your interest in contributing to LineCount! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Architecture Overview](#architecture-overview)

## Code of Conduct

This project follows a standard code of conduct. Please be respectful and constructive in all interactions.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/linecount.git
   cd linecount
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/Aman-CERP/linecount.git
   ```
4. **Install dependencies**:
   ```bash
   bun install
   ```
5. **Verify setup**:
   ```bash
   bun run build
   bun run test:unit
   bun run lint
   ```

## Development Setup

### Prerequisites

| Tool | Version | Installation |
|------|---------|-------------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Bun | latest | `curl -fsSL https://bun.sh/install \| bash` |
| VS Code | 1.85+ | [code.visualstudio.com](https://code.visualstudio.com/) |
| Git | 2.0+ | [git-scm.com](https://git-scm.com/) |

### Recommended VS Code Extensions

When you open the project, VS Code will recommend these extensions (configured in `.vscode/extensions.json`):
- ESLint
- Prettier
- EditorConfig

### Development Workflow

```bash
# Start watch mode (auto-rebuild on changes)
bun run watch

# In VS Code, press F5 to launch Extension Development Host
# Make changes -> extension reloads automatically

# Run tests
bun run test:unit        # Unit tests (fast, no VS Code needed)
bun run test:integration # Integration tests (launches VS Code)

# Lint and format
bun run lint
bun run format
```

## Making Changes

### Branch Naming

Create a branch from `main` using one of these prefixes:

| Prefix | Use For | Example |
|--------|---------|---------|
| `feat/` | New features | `feat/status-bar-provider` |
| `fix/` | Bug fixes | `fix/cache-invalidation` |
| `docs/` | Documentation | `docs/add-comment-parsing-guide` |
| `test/` | Test additions | `test/line-counter-edge-cases` |
| `refactor/` | Code refactoring | `refactor/extract-path-utils` |
| `chore/` | Build/tooling changes | `chore/update-esbuild` |

```bash
git checkout -b feat/my-feature
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`

**Examples**:
```
feat(cache): add mtime-based cache invalidation
fix(counter): handle empty files returning 0 instead of 1
docs(adr): add ADR-005 for comment counting strategy
test(formatters): add edge cases for million-scale numbers
refactor(classifier): extract binary extension check to constant
chore(ci): add macOS to test matrix
```

### What to Change

- **New feature**: Create the service/provider, add unit tests, wire in extension.ts, update package.json contributes if needed
- **Bug fix**: Write a failing test first, then fix the bug, verify the test passes
- **Documentation**: Update relevant docs in `docs/`, and the README if user-facing

### What NOT to Change

- Do not modify `package.json` version (maintainers handle releases)
- Do not add runtime dependencies (see [ADR 003](docs/adr/003-zero-runtime-deps.md))
- Do not modify CI workflows without discussion first

## Pull Request Process

1. **Update your branch** with the latest from main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure all checks pass**:
   ```bash
   bun run lint
   bun run compile      # Type checking
   bun run build:prod   # Production build
   bun run test:unit    # Unit tests
   ```

3. **Push your branch**:
   ```bash
   git push origin feat/my-feature
   ```

4. **Open a Pull Request** against `main` using the PR template

5. **Address review feedback** by pushing additional commits (don't force-push during review)

### PR Requirements

- [ ] All CI checks pass (lint, compile, build, test on 3 OS)
- [ ] Unit tests added for new logic (90% coverage target for pure logic)
- [ ] Integration tests added if new VS Code UI behavior
- [ ] Documentation updated if user-facing changes
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] No new runtime dependencies
- [ ] Code follows project style (ESLint + Prettier)

## Coding Standards

### Architecture Rules

1. **No module-level mutable state**: All state must live inside service class instances
2. **Dependency injection**: Services receive dependencies via constructor, never import directly
3. **Implement `vscode.Disposable`**: Every service that holds resources must clean up in `dispose()`
4. **Single responsibility**: Each file should have one primary purpose and be < 150 lines
5. **Types in `src/types/`**: Shared interfaces go in the types directory, not scattered across files

### TypeScript Rules

- **Strict mode**: `strict: true` in tsconfig.json (no `any`, no implicit returns, etc.)
- **Explicit return types** on public methods
- **Readonly properties** where mutation is not needed
- **Use `const` assertions** for literal objects that shouldn't be widened

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Service files | PascalCase | `CacheService.ts` |
| Utility files | camelCase | `formatters.ts` |
| Test files | camelCase + `.test` | `formatters.test.ts` |
| Classes | PascalCase | `CacheService` |
| Interfaces | PascalCase (no `I` prefix) | `LineCountResult` |
| Functions | camelCase | `formatLineCount` |
| Constants | UPPER_SNAKE_CASE | `BINARY_EXTENSIONS` |

### Error Handling

- Catch errors at service boundaries (provider methods)
- Log errors with context: `console.error(\`[LineCount] Error in ${context}:\`, error)`
- Return `undefined` from providers on error (don't throw)
- Use `try/finally` to ensure cleanup (dispose, flag reset, etc.)

## Testing Requirements

### Unit Tests (bun:test)

- Test all pure logic (formatters, cache, classifier, counter, debounce, comment parser)
- No VS Code imports in unit tests
- Use test fixtures from `test/fixtures/` for file-based tests
- Target: 90% coverage for `src/utils/` and `src/services/`

```typescript
import { describe, test, expect } from 'bun:test';

describe('formatLineCount', () => {
  test('returns "0" for zero lines', () => {
    expect(formatLineCount(0)).toBe('0');
  });
});
```

### Integration Tests (@vscode/test-cli)

- Test VS Code-specific behavior (activation, decorations, commands)
- Run inside a real VS Code instance
- Use the `test/fixtures/` workspace
- Target: 70% coverage for providers and commands

### Test Fixture Guidelines

- Keep fixtures small and focused
- Document what each fixture tests (in the fixture file or test file)
- Use real file extensions (`.js`, `.py`, `.ts`) not `.test` files
- Include edge cases: empty files, single-line, CRLF, no trailing newline

## Reporting Bugs

Use the [Bug Report template](https://github.com/Aman-CERP/linecount/issues/new?template=bug_report.md) and include:

1. **VS Code version** and **OS**
2. **LineCount version**
3. **Steps to reproduce**
4. **Expected behavior**
5. **Actual behavior**
6. **Screenshots** (if visual issue)
7. **Extension Output** (Output panel > LineCount)

## Requesting Features

Use the [Feature Request template](https://github.com/Aman-CERP/linecount/issues/new?template=feature_request.md) and include:

1. **Problem description**: What are you trying to do?
2. **Proposed solution**: How should it work?
3. **Alternatives considered**: What else did you think about?
4. **Phase alignment**: Does this fit v0.5 or v1.0 features?

## Architecture Overview

For a detailed understanding of the codebase, read:

- [Architecture Document](docs/architecture.md) - High-level design and data flow
- [Developer Guide](docs/developer-guide.md) - Setup, build, test, debug
- [ADRs](docs/adr/) - Rationale for key technical decisions

The key principle: each service is independently testable with constructor-based dependency injection. No global state, no shared timers, no tight coupling between components.
