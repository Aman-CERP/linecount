# ADR 004: Bun for Development Toolchain

## Status

Accepted

## Date

2026-02-07

## Context

The development toolchain for a VS Code extension involves several tasks:

1. **Package management**: Installing devDependencies
2. **Script running**: Executing build, lint, test, and publish commands
3. **Unit testing**: Running tests for pure logic modules
4. **Integration testing**: Running tests inside a real VS Code instance
5. **Bundling**: Producing the production extension bundle

The original LineSight extension uses `npm` for all of these. We evaluated alternatives:

| Tool | Package Install | Script Running | Unit Test Runner | Integration Tests |
|------|----------------|----------------|-----------------|-------------------|
| **npm** | ~15s | ~200ms overhead | Needs jest/vitest | Node.js (supported) |
| **pnpm** | ~8s | ~150ms overhead | Needs jest/vitest | Node.js (supported) |
| **Bun** | ~3s | ~50ms overhead | Built-in `bun:test` | N/A (needs Node.js) |
| **yarn** | ~10s | ~150ms overhead | Needs jest/vitest | Node.js (supported) |

### Key Consideration: VS Code Integration Tests

VS Code integration tests require `@vscode/test-cli` and `@vscode/test-electron`, which:
- Launch a real VS Code instance
- Run the extension host in **Node.js** (not Bun)
- Execute test files using Node.js's module system

This means **integration tests must run on Node.js regardless of the development toolchain choice**.

### Key Consideration: Extension Runtime

VS Code extensions always execute in the VS Code extension host, which is a **Node.js process**. The extension itself is a CommonJS bundle loaded by Node.js. Bun is never involved at runtime.

## Decision

We will use **Bun** as the primary development toolchain with the following boundaries:

### What Bun Handles

| Task | Command | Notes |
|------|---------|-------|
| Package management | `bun install` | Generates `bun.lockb`, significantly faster than npm |
| Script running | `bun run <script>` | Runs all package.json scripts |
| Unit tests | `bun test` | Uses built-in `bun:test` - no jest/vitest dependency needed |
| Build trigger | `bun esbuild.js` | Invokes esbuild (which uses Node.js internally) |
| Watch mode | `bun esbuild.js --watch` | Fast file watching for development |

### What Still Uses Node.js

| Task | Command | Reason |
|------|---------|--------|
| esbuild bundling | `bun esbuild.js` (esbuild runs on Node.js) | esbuild produces Node.js-compatible CJS |
| Integration tests | `vscode-test` | `@vscode/test-electron` requires Node.js |
| Extension runtime | N/A | VS Code extension host is always Node.js |
| Publishing | `vsce publish` / `ovsx publish` | Publishing tools run on Node.js |

### Configuration

**bunfig.toml:**
```toml
[install]
peer = false

[test]
preload = ["./test/setup.ts"]
```

**CI Pipeline:**
```yaml
steps:
  - uses: oven-sh/setup-bun@v2
    with:
      bun-version: latest
  - run: bun install --frozen-lockfile
  - run: bun run lint
  - run: bun run compile
  - run: bun run build:prod
  - run: bun run test:unit        # Uses bun:test
  - run: bun run test:integration  # Uses @vscode/test-cli (Node.js)
```

### Unit Test Example

```typescript
// test/unit/formatters.test.ts
import { describe, test, expect } from 'bun:test';
import { formatLineCount } from '../../src/utils/formatters';

describe('formatLineCount', () => {
  test('returns "0" for zero lines', () => {
    expect(formatLineCount(0)).toBe('0');
  });
});
```

`bun:test` is API-compatible with Jest, so migration to Jest (if ever needed) requires only changing the import.

## Consequences

### Positive

- **Fast installs**: `bun install` is 3-5x faster than `npm install`, improving CI times and developer experience
- **Fast unit tests**: `bun test` starts in <100ms vs. jest's ~2s startup
- **Zero test dependency**: `bun:test` is built-in, removing jest/vitest from devDependencies
- **Consistent script running**: `bun run` has lower overhead than `npm run`
- **Lock file**: `bun.lockb` is a binary lock file, faster to parse than `package-lock.json`

### Negative

- **Additional CI setup**: CI must install both Node.js (for VS Code tests) and Bun (for unit tests)
- **Developer requirement**: Contributors must install Bun (in addition to Node.js)
- **Lock file format**: `bun.lockb` is binary and not human-readable (unlike `package-lock.json`)
- **Ecosystem maturity**: Bun is newer than npm/yarn/pnpm and may have edge cases with some packages

### Mitigations

- The developer guide documents Bun installation and explains the Node.js/Bun boundary
- CI workflow uses `oven-sh/setup-bun@v2` for reliable Bun installation
- If Bun causes issues with a specific package, we can fall back to npm for that task while keeping Bun for unit tests
- `bun:test` is Jest-compatible, so migrating away from Bun for testing is a one-line import change
