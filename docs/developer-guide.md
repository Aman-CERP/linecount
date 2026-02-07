# LineCount Developer Guide

This guide covers everything you need to set up, build, test, debug, and contribute to the LineCount VS Code extension.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Build System](#build-system)
- [Testing](#testing)
- [Debugging](#debugging)
- [Code Style](#code-style)
- [Adding a New Service](#adding-a-new-service)
- [Adding a New Command](#adding-a-new-command)
- [Adding a New Language for Comment Parsing](#adding-a-new-language-for-comment-parsing)
- [Working with the Webview Dashboard](#working-with-the-webview-dashboard)
- [Publishing](#publishing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 18+ | VS Code extension host runtime, integration tests |
| **Bun** | latest | Package management, unit tests, script runner |
| **VS Code** | 1.85+ | Extension development and debugging |
| **Git** | 2.0+ | Version control |

### Installing Bun

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"

# Verify
bun --version
```

### Why Both Node.js and Bun?

Bun handles package management and unit testing (fast installs, built-in test runner). Node.js is required because:
- VS Code extension host runs on Node.js
- Integration tests (`@vscode/test-electron`) launch a real VS Code instance with Node.js
- esbuild produces Node.js-compatible bundles

See [ADR 004](./adr/004-bun-toolchain.md) for the full rationale.

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Aman-CERP/linecount.git
cd linecount

# Install dependencies
bun install

# Build the extension
bun run build

# Run unit tests
bun run test:unit

# Open in VS Code
code .
```

To test the extension:
1. Press `F5` in VS Code (or Run > Start Debugging)
2. A new VS Code window opens with the extension loaded
3. Open a folder with files - you should see line count badges in the explorer

---

## Project Structure

```
linecount/
├── src/                     # Extension source code
│   ├── extension.ts         # Entry point (creates services, registers them)
│   ├── types/               # TypeScript interfaces and type definitions
│   ├── services/            # Business logic (no VS Code UI dependencies)
│   ├── providers/           # VS Code UI providers (decorations, status bar, webview)
│   ├── commands/            # Command handlers
│   └── utils/               # Pure utility functions
├── test/
│   ├── unit/                # bun:test (pure logic, no VS Code dependency)
│   ├── integration/         # @vscode/test-cli (runs inside real VS Code)
│   └── fixtures/            # Test data files
├── webview/                 # React dashboard (v1.0, separate build)
├── docs/                    # Documentation
│   └── adr/                 # Architecture Decision Records
├── dist/                    # Build output (git-ignored)
├── esbuild.js              # Build script
└── package.json             # Project manifest
```

### Key Directories

**`src/services/`**: Contains all business logic. Services are classes that:
- Accept dependencies via constructor (dependency injection)
- Implement `vscode.Disposable` for cleanup
- Have no module-level mutable state
- Are independently testable

**`src/providers/`**: VS Code-specific UI implementations:
- `FileDecorationProvider`: Explorer badges
- `StatusBarProvider`: Bottom status bar (v0.5)
- `DashboardPanelProvider`: React webview (v1.0)
- `LanguageTreeProvider`: Sidebar tree view (v1.0)

**`src/utils/`**: Pure functions with no side effects. Every function in utils/ should be testable with simple input/output assertions.

**`src/types/`**: Shared TypeScript interfaces. No implementation code.

---

## Build System

### Scripts

| Command | What It Does |
|---------|-------------|
| `bun run build` | Bundle extension with esbuild (development, with sourcemaps) |
| `bun run build:prod` | Bundle for production (minified, no sourcemaps) |
| `bun run watch` | Watch mode - rebuilds on file changes (<10ms rebuilds) |
| `bun run compile` | Type-check only (`tsc --noEmit`), no output |
| `bun run lint` | Run ESLint on `src/` |
| `bun run lint:fix` | Run ESLint with auto-fix |
| `bun run format` | Format with Prettier |
| `bun run test:unit` | Run unit tests with bun:test |
| `bun run test:integration` | Run integration tests with @vscode/test-cli |
| `bun run test` | Run all tests (unit + integration) |
| `bun run package` | Create .vsix package |

### Build Pipeline

```
src/**/*.ts ──► esbuild ──► dist/extension.js (single CJS bundle)
                  │
                  ├── external: ['vscode']  (not bundled)
                  ├── format: 'cjs'         (CommonJS for VS Code)
                  ├── platform: 'node'      (Node.js runtime)
                  └── target: 'node18'      (minimum Node.js)
```

The `tsc` compiler is used **only for type checking** (`tsc --noEmit`). The actual bundle is produced by esbuild, which is much faster but doesn't do type checking.

### Output Directories

| Directory | Contents | Git-ignored |
|-----------|----------|-------------|
| `dist/` | esbuild production bundle | Yes |
| `out/` | tsc output (if running tsc directly, for debugging) | Yes |
| `node_modules/` | Dependencies | Yes |

---

## Testing

### Unit Tests (bun:test)

Unit tests cover pure logic that doesn't depend on VS Code APIs:
- Formatters (number formatting)
- Path utilities (normalization, cross-platform)
- Cache service (LRU logic, mtime invalidation)
- File classifier (binary detection, skip logic)
- Line counter (counting logic with file fixtures)
- Debounce queue (timer behavior, URI accumulation)
- Comment parser (v0.5, per-language syntax)

```bash
# Run all unit tests
bun run test:unit

# Run a specific test file
bun test test/unit/formatters.test.ts

# Run tests matching a pattern
bun test --grep "formats thousands"

# Watch mode
bun test --watch
```

**Writing a unit test:**

```typescript
// test/unit/formatters.test.ts
import { describe, test, expect } from 'bun:test';
import { formatLineCount } from '../../src/utils/formatters';

describe('formatLineCount', () => {
  test('returns "0" for zero lines', () => {
    expect(formatLineCount(0)).toBe('0');
  });

  test('returns exact count below 1000', () => {
    expect(formatLineCount(42)).toBe('42');
    expect(formatLineCount(999)).toBe('999');
  });

  test('formats thousands with K suffix', () => {
    expect(formatLineCount(1500)).toBe('1.5K');
  });
});
```

### Integration Tests (@vscode/test-cli)

Integration tests run inside a real VS Code instance. They verify:
- Extension activates successfully
- File decorations appear in the explorer
- Commands execute correctly
- Configuration changes take effect

```bash
# Run integration tests
bun run test:integration
```

Integration tests are configured in `.vscode-test.mjs`:

```javascript
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  workspaceFolder: './test/fixtures',
  mocha: {
    timeout: 20000,
  },
});
```

**Note**: Integration tests require building first (`bun run build`) because they run the compiled JavaScript, not TypeScript directly.

### Test Fixtures

Test fixtures are real files in `test/fixtures/` used by both unit and integration tests:

| Fixture | Purpose |
|---------|---------|
| `empty.txt` | Tests empty file → 0 lines |
| `single-line.txt` | Tests single line with/without trailing newline |
| `multi-line.js` | Standard multi-line file |
| `no-trailing-newline.py` | File without trailing newline |
| `crlf-endings.ts` | Windows-style line endings (\\r\\n) |
| `mixed-endings.txt` | Mix of \\n and \\r\\n |
| `large-file.txt` | File > 512KB for stream reading path |
| `commented.js` | JavaScript with comments (v0.5) |
| `block-comments.py` | Python with docstrings (v0.5) |
| `mixed.html` | HTML with embedded JS/CSS (v0.5) |

### Coverage Target

| Test Type | Target |
|-----------|--------|
| Unit tests (pure logic) | 90%+ |
| Integration tests | 70%+ |

---

## Debugging

### Debugging the Extension

1. Open the project in VS Code
2. Press `F5` or go to Run > Start Debugging
3. Select "Run Extension" launch configuration
4. A new VS Code window opens with the extension loaded (Extension Development Host)
5. Open a folder with files to see badges
6. Set breakpoints in `src/` files - they will hit during execution

The launch configuration is in `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "watch"
    }
  ]
}
```

### Debugging Tips

- **View extension output**: In the Extension Development Host, open Output panel > select "LineCount" from the dropdown
- **Inspect decorations**: Open a folder, look at explorer badges. If badges are missing, check the Output panel for errors
- **Force refresh**: Run command "LineCount: Refresh All Counts" from the Command Palette
- **Watch mode**: The `watch` pre-launch task automatically rebuilds on changes. After editing code, the Extension Development Host reloads automatically
- **Configuration debugging**: Change settings in the Extension Development Host's Settings UI, check if `ConfigurationService` picks up the changes

### Common Debug Scenarios

| Scenario | What to Check |
|----------|--------------|
| Badges not showing | Is the file type in `CODE_EXTENSIONS`? Is the directory in `SKIP_DIRS`? |
| Badge not updating | Is the file watcher firing? Check `ignoreChangeEvents` flag. Is the debounce delay too long? |
| Extension not activating | Check `activationEvents` in package.json. Check for errors in the Extension Development Host's Console (Help > Toggle Developer Tools) |
| Wrong line count | Check the test fixture for that file type. Is it a CRLF file? Is it empty? |

---

## Code Style

### ESLint

We use ESLint 9 with flat config (`eslint.config.mjs`):
- TypeScript-aware rules via `@typescript-eslint`
- No unused variables/imports
- Consistent return types

```bash
bun run lint       # Check for issues
bun run lint:fix   # Auto-fix what's possible
```

### Prettier

Formatting is handled by Prettier (`.prettierrc.json`):
- Single quotes
- 2-space indentation
- Trailing commas
- 100 character line width

```bash
bun run format     # Format all TypeScript files in src/
```

### EditorConfig

`.editorconfig` ensures consistent settings across editors:
- UTF-8 encoding
- LF line endings
- 2-space indentation for TypeScript/JavaScript
- Trim trailing whitespace
- Final newline

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (services) | PascalCase | `CacheService.ts` |
| Files (utils) | camelCase | `formatters.ts` |
| Files (tests) | camelCase + `.test` | `formatters.test.ts` |
| Classes | PascalCase | `CacheService` |
| Interfaces | PascalCase (no `I` prefix) | `LineCountResult` |
| Functions | camelCase | `formatLineCount` |
| Constants | UPPER_SNAKE_CASE | `BINARY_EXTENSIONS` |
| Config properties | camelCase | `linecount.debounceDelay` |

---

## Adding a New Service

1. **Create the interface** in `src/types/index.ts`:

```typescript
export interface MyNewResult {
  // ...
}
```

2. **Create the service** in `src/services/MyNewService.ts`:

```typescript
import * as vscode from 'vscode';
import { ConfigurationService } from './ConfigurationService';

export class MyNewService implements vscode.Disposable {
  constructor(private readonly config: ConfigurationService) {}

  async doSomething(): Promise<MyNewResult> {
    // Implementation
  }

  dispose(): void {
    // Cleanup
  }
}
```

3. **Write unit tests** in `test/unit/myNewService.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
// Test the pure logic, mock VS Code dependencies
```

4. **Wire it up** in `src/extension.ts`:

```typescript
const myService = new MyNewService(config);
context.subscriptions.push(myService);
```

5. **Update architecture docs** if the service introduces a new data flow.

---

## Adding a New Command

1. **Create the command handler** in `src/commands/myCommand.ts`:

```typescript
import * as vscode from 'vscode';

export function registerMyCommand(
  /* dependencies */
): vscode.Disposable {
  return vscode.commands.registerCommand('linecount.myCommand', async () => {
    // Implementation
  });
}
```

2. **Register in package.json** `contributes.commands`:

```json
{
  "command": "linecount.myCommand",
  "title": "LineCount: My New Command"
}
```

3. **Wire in extension.ts**:

```typescript
context.subscriptions.push(registerMyCommand(/* deps */));
```

4. **Add integration test** to verify the command executes.

---

## Adding a New Language for Comment Parsing

To add comment syntax for a new language:

1. **Edit `src/utils/constants.ts`** and add an entry to `COMMENT_SYNTAX`:

```typescript
export const COMMENT_SYNTAX: Record<string, CommentSyntax> = {
  // ... existing entries ...
  '.lua': {
    lineComment: ['--'],
    blockComment: [['--[[', ']]']],
  },
};
```

2. **Create a test fixture** in `test/fixtures/` (e.g., `commented.lua`)

3. **Add test cases** in `test/unit/commentParser.test.ts`:

```typescript
test('parses Lua comments', () => {
  const result = parse(luaContent, '.lua');
  expect(result.comment).toBe(expectedCommentLines);
  expect(result.code).toBe(expectedCodeLines);
});
```

See [ADR 005](./adr/005-comment-counting-strategy.md) for the comment parsing strategy.

---

## Working with the Webview Dashboard

The webview dashboard (v1.0) is a separate React project in `webview/`.

### Setup

```bash
cd webview
bun install
```

### Development

```bash
# Start Vite dev server (HMR)
bun run dev

# Build for production
bun run build
```

### Architecture

- **Extension side**: `DashboardPanelProvider` creates the webview, sets CSP, loads the React bundle, and sends data via `postMessage`
- **Webview side**: React app receives messages via `useVSCodeApi` hook, renders charts with Recharts

### Theming

The dashboard uses VS Code CSS variables (not the deprecated `@vscode/webview-ui-toolkit`):

```css
color: var(--vscode-editor-foreground);
background: var(--vscode-editor-background);
```

This automatically adapts to light, dark, and high contrast themes.

See [ADR 006](./adr/006-webview-react-vite.md) for the full rationale.

---

## Publishing

### Prerequisites

- Azure DevOps Personal Access Token with Marketplace scope
- Publisher `AmanERP` created on the VS Code Marketplace
- Open VSX namespace `AmanERP` created

### Manual Publishing

```bash
# Build production bundle
bun run build:prod

# Create VSIX package
bun run package

# Publish to VS Code Marketplace
bun run publish:vsce

# Publish to Open VSX
bun run publish:ovsx
```

### Automated Publishing

Push a tag to trigger the release workflow:

```bash
# Tag a release
git tag v0.1.0
git push origin v0.1.0
```

The `.github/workflows/release.yml` workflow will:
1. Build the production bundle
2. Run unit tests
3. Create VSIX package
4. Publish to VS Code Marketplace
5. Publish to Open VSX
6. Create a GitHub release with the VSIX attached

### Version Bumping

```bash
# Patch: v0.1.0 -> v0.1.1
npm version patch

# Minor: v0.1.0 -> v0.2.0
npm version minor

# Major: v0.1.0 -> v1.0.0
npm version major
```

---

## Troubleshooting

### "Cannot find module 'vscode'"

This is expected when running unit tests. The `vscode` module is only available inside the VS Code extension host. Unit tests should not import from `vscode` directly - they test pure logic only.

### "bun: command not found"

Install Bun: `curl -fsSL https://bun.sh/install | bash`

### Integration tests fail with "VS Code not found"

Ensure `@vscode/test-electron` is installed and can download VS Code:
```bash
bun run test:integration
```
On first run, it downloads a VS Code instance (~200MB).

### Build output is empty

Check that `src/extension.ts` exists and exports `activate`. Run `bun run build` and check for errors.

### Badges not showing in debug

1. Ensure the extension is activated (check Output panel)
2. Open a workspace folder (not a single file)
3. Check that the file extension is in `CODE_EXTENSIONS`
4. Check that the file's directory is not in `SKIP_DIRS`

### ESLint errors on import order

Run `bun run lint:fix` to auto-sort imports.

### Windows line endings causing test failures

The `.editorconfig` and `.gitattributes` enforce LF line endings. If you see `\r\n` in test fixtures, configure git:
```bash
git config core.autocrlf false
```

---

## Related Documents

- [Architecture](./architecture.md) - High-level system design
- [ADRs](./adr/) - Architecture Decision Records explaining key choices
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [CHANGELOG.md](../CHANGELOG.md) - Version history
