# LineCount Architecture

## Overview

LineCount is a VS Code extension that displays line count badges in the file explorer. It is built as a modular service architecture (see [ADR 001](./adr/001-modular-architecture.md)) with zero runtime dependencies (see [ADR 003](./adr/003-zero-runtime-deps.md)).

The extension is delivered in three phases:
- **v0.1**: Core line counting with explorer badges
- **v0.5**: Comment/blank/code breakdown, status bar, color-coded badges
- **v1.0**: React dashboard, git integration, language tree, export reports

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        VS Code Host                            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Extension Process                      │  │
│  │                                                          │  │
│  │  ┌──────────────┐                                        │  │
│  │  │ extension.ts  │  Entry point: creates all services,   │  │
│  │  │  (~30 lines)  │  wires dependencies, registers with   │  │
│  │  │               │  VS Code, pushes to subscriptions     │  │
│  │  └──────┬────────┘                                       │  │
│  │         │ creates                                        │  │
│  │         ▼                                                │  │
│  │  ┌─────────────────────────────────────────────────┐     │  │
│  │  │              Service Layer                       │     │  │
│  │  │                                                  │     │  │
│  │  │  ┌─────────────────┐  ┌────────────────────┐    │     │  │
│  │  │  │ ConfigService    │  │ CacheService       │    │     │  │
│  │  │  │ reads settings   │  │ LRU + mtime+size   │    │     │  │
│  │  │  └────────┬────────┘  └─────────┬──────────┘    │     │  │
│  │  │           │                     │                │     │  │
│  │  │  ┌────────┴─────────────────────┴──────────┐    │     │  │
│  │  │  │ FileClassifierService                    │    │     │  │
│  │  │  │ binary detection, skip dirs, symlinks    │    │     │  │
│  │  │  └────────┬────────────────────────────────┘    │     │  │
│  │  │           │                                      │     │  │
│  │  │  ┌────────┴────────────────────────────────┐    │     │  │
│  │  │  │ LineCounterService                       │    │     │  │
│  │  │  │ readFile (<512KB) / stream (larger)      │    │     │  │
│  │  │  │ ─── uses CommentParserService (v0.5) ──>│    │     │  │
│  │  │  └────────┬────────────────────────────────┘    │     │  │
│  │  │           │                                      │     │  │
│  │  │  ┌────────┴────────┐  ┌──────────────────┐     │     │  │
│  │  │  │ GitService      │  │ ExportService    │     │     │  │
│  │  │  │ (v1.0)          │  │ (v1.0)           │     │     │  │
│  │  │  └────────┬────────┘  └──────────────────┘     │     │  │
│  │  │           │                                      │     │  │
│  │  └───────────┼──────────────────────────────────┘   │     │  │
│  │              │                                       │     │  │
│  │  ┌───────────┼──────────────────────────────────┐   │     │  │
│  │  │           ▼   Provider Layer                  │   │     │  │
│  │  │                                               │   │     │  │
│  │  │  ┌──────────────────────┐                     │   │     │  │
│  │  │  │ FileDecorationProv.  │ Explorer badges     │   │     │  │
│  │  │  │ + DebouncedUriQueue  │ File watchers       │   │     │  │
│  │  │  └──────────────────────┘                     │   │     │  │
│  │  │                                               │   │     │  │
│  │  │  ┌──────────────────────┐                     │   │     │  │
│  │  │  │ StatusBarProvider    │ Active file stats   │   │     │  │
│  │  │  │ (v0.5)              │                      │   │     │  │
│  │  │  └──────────────────────┘                     │   │     │  │
│  │  │                                               │   │     │  │
│  │  │  ┌──────────────────────┐                     │   │     │  │
│  │  │  │ DashboardPanelProv. │ React webview        │   │     │  │
│  │  │  │ (v1.0)              │                      │   │     │  │
│  │  │  └──────────────────────┘                     │   │     │  │
│  │  │                                               │   │     │  │
│  │  │  ┌──────────────────────┐                     │   │     │  │
│  │  │  │ LanguageTreeProv.   │ Sidebar tree         │   │     │  │
│  │  │  │ (v1.0)              │                      │   │     │  │
│  │  │  └──────────────────────┘                     │   │     │  │
│  │  │                                               │   │     │  │
│  │  └───────────────────────────────────────────────┘   │     │  │
│  │                                                       │     │  │
│  └───────────────────────────────────────────────────────┘     │  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Webview Process (v1.0)                    │  │
│  │  ┌──────────────────────────────────────────────┐        │  │
│  │  │  React App (compiled by Vite)                 │        │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │        │  │
│  │  │  │ PieChart │ │BarChart  │ │ AuthorTable   │  │        │  │
│  │  │  └──────────┘ └──────────┘ └──────────────┘  │        │  │
│  │  │  Communication: postMessage <-> onMessage     │        │  │
│  │  └──────────────────────────────────────────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Repository Structure

```
linecount/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Lint + test on push/PR (3 OS x 2 Node)
│   │   └── release.yml               # Publish to Marketplace + Open VSX on tag
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── .vscode/
│   ├── launch.json                   # Extension debug config
│   ├── tasks.json                    # esbuild watch task
│   ├── settings.json                 # Workspace dev settings
│   └── extensions.json               # Recommended extensions
├── docs/
│   ├── adr/                          # Architecture Decision Records
│   │   ├── 001-modular-architecture.md
│   │   ├── 002-esbuild-bundler.md
│   │   ├── 003-zero-runtime-deps.md
│   │   ├── 004-bun-toolchain.md
│   │   ├── 005-comment-counting-strategy.md    # v0.5
│   │   ├── 006-webview-react-vite.md           # v1.0
│   │   └── 007-git-integration-approach.md     # v1.0
│   ├── architecture.md               # This document
│   ├── developer-guide.md            # Setup, build, test, debug, contribute
│   └── api-reference.md              # Internal API docs (v1.0)
├── src/
│   ├── extension.ts                  # Entry point (~30 lines)
│   ├── types/
│   │   ├── index.ts                  # Shared interfaces
│   │   └── configuration.ts          # Config schema types
│   ├── services/
│   │   ├── LineCounterService.ts     # Core counting
│   │   ├── CacheService.ts           # LRU cache
│   │   ├── FileClassifierService.ts  # Binary/text/skip
│   │   ├── ConfigurationService.ts   # Settings wrapper
│   │   ├── CommentParserService.ts   # Comment parsing        [v0.5]
│   │   ├── GitService.ts             # Git operations          [v1.0]
│   │   └── ExportService.ts          # Report generation       [v1.0]
│   ├── providers/
│   │   ├── FileDecorationProvider.ts # Explorer badges
│   │   ├── StatusBarProvider.ts      # Active file stats       [v0.5]
│   │   ├── LanguageTreeProvider.ts   # Language tree view       [v1.0]
│   │   └── DashboardPanelProvider.ts # React webview            [v1.0]
│   ├── commands/
│   │   ├── refreshCommand.ts         # linecount.refresh
│   │   ├── summaryCommand.ts         # linecount.showSummary   [v0.5]
│   │   └── exportCommand.ts          # linecount.exportReport  [v1.0]
│   └── utils/
│       ├── formatters.ts             # Number formatting
│       ├── constants.ts              # Extension sets, skip dirs
│       ├── debounce.ts               # DebouncedUriQueue
│       ├── cancellation.ts           # CancellationToken utils
│       └── pathUtils.ts              # Path normalization
├── test/
│   ├── unit/                         # bun:test
│   ├── integration/                  # @vscode/test-cli
│   └── fixtures/                     # Test data files
├── webview/                          # React dashboard [v1.0]
│   ├── src/
│   ├── vite.config.ts
│   └── package.json
├── resources/
│   ├── images/                       # Extension icon
│   └── icons/                        # Activity bar icon [v1.0]
├── esbuild.js                        # Build script
├── .vscode-test.mjs                  # Integration test config
├── bunfig.toml                       # Bun configuration
├── package.json
├── tsconfig.json
├── eslint.config.mjs                 # ESLint 9 flat config
├── .prettierrc.json
├── .editorconfig
├── .gitignore
├── .vscodeignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Data Flow

### Badge Display Flow (v0.1)

```
1. VS Code explorer renders a file
   │
   ▼
2. VS Code calls FileDecorationProvider.provideFileDecoration(uri)
   │
   ▼
3. FileDecorationProvider checks:
   ├─ uri.scheme === 'file'?          → if not, return undefined
   ├─ FileClassifier.shouldSkip(uri)? → if yes, return undefined
   └─ CacheService.get(uri)?          → if cached & fresh, return cached decoration
   │
   ▼
4. LineCounterService.countLines(uri)
   ├─ fs.stat(uri.fsPath)             → get size + mtime
   ├─ size === 0?                     → return { total: 0 }
   ├─ size > sizeLimit?               → return estimated count with "~" prefix
   ├─ size < 512KB?                   → fs.readFile + count newlines
   └─ size >= 512KB?                  → createReadStream + count newlines (10s timeout)
   │
   ▼
5. CacheService.set(uri, result, { mtimeMs, size })
   │
   ▼
6. Format count: formatLineCount(result.total)
   ├─ 0              → "0"
   ├─ 1-999          → exact ("42")
   ├─ 1,000-999,999  → "1.2K"
   └─ 1,000,000+     → "1.5M"
   │
   ▼
7. Return FileDecoration { badge: "42", tooltip: "42 lines" }
```

### File Change Update Flow (v0.1)

```
1. User edits and saves a file
   │
   ├─ FileSystemWatcher.onDidChange(uri)    [ignoreChangeEvents: false]
   └─ workspace.onDidSaveTextDocument(doc)  [immediate feedback]
   │
   ▼
2. DebouncedUriQueue.add(uri)
   ├─ Adds uri.fsPath to internal Set<string>  [accumulates, never drops]
   └─ Resets debounce timer (configurable delay, default 300ms)
   │
   ▼
3. After debounce delay: DebouncedUriQueue flushes
   │
   ▼
4. CacheService.invalidate(uri) for each accumulated URI
   │
   ▼
5. FileDecorationProvider fires onDidChangeFileDecorations(uris)
   │
   ▼
6. VS Code re-calls provideFileDecoration(uri) → Badge Display Flow
```

### Comment Breakdown Flow (v0.5)

```
1. LineCounterService.countLines(uri, { detailed: true })
   │
   ▼
2. Read file content (readFile or stream)
   │
   ▼
3. CommentParserService.parse(content, extension)
   ├─ Look up CommentSyntax for the file extension
   ├─ If no syntax found → all non-blank lines are "code"
   └─ Run state machine parser:
       │
       State: NORMAL or IN_BLOCK_COMMENT
       │
       For each line:
       ├─ Trim whitespace
       ├─ Empty? → blank++
       ├─ IN_BLOCK_COMMENT?
       │   ├─ Contains end marker? → comment++, state = NORMAL
       │   └─ No end marker? → comment++
       └─ NORMAL?
           ├─ Starts with line comment? → comment++
           ├─ Starts with block comment start? → comment++, state = IN_BLOCK_COMMENT
           └─ Otherwise → code++
   │
   ▼
4. Return { total, code, comment, blank }
```

### Dashboard Data Flow (v1.0)

```
Extension Process                    Webview Process (React)
─────────────────                    ──────────────────────

DashboardPanelProvider               App.tsx
  │                                    │
  │ ── postMessage({                   │
  │      type: 'update',              │
  │      data: {                       │
  │        languages: [...],           │
  │        topFiles: [...],           ▼
  │        authors: [...],         useVSCodeApi() hook
  │        trends: [...]             receives message
  │      }                             │
  │    }) ─────────────────────────>   │
  │                                    ▼
  │                               State update
  │                                    │
  │                            ┌───────┼────────┐
  │                            ▼       ▼        ▼
  │                        PieChart  BarChart  Table
  │                                    │
  │    <──────────────────────────     │
  │ onDidReceiveMessage({              │
  │   type: 'refresh'            User clicks
  │ })                           "Refresh" button
```

## Service Dependency Graph

```
ConfigurationService  ←──────────────────────────────────────────────────┐
       │                                                                  │
       │ injected into                                                    │
       ▼                                                                  │
CacheService ◄─── maxSize from config                                     │
       │                                                                  │
       │ injected into                                                    │
       ▼                                                                  │
FileClassifierService ◄─── excludeDirs, excludeExtensions from config     │
       │                                                                  │
       │ injected into                                                    │
       ▼                                                                  │
LineCounterService ◄─── sizeLimit from config                             │
       │    │                                                             │
       │    └──► CommentParserService (v0.5, no config dependency)        │
       │                                                                  │
       │ injected into                                                    │
       ├──────────────────────────────────────────────────────────────────┘
       │
       ▼
FileDecorationProvider ◄─── warningThreshold, errorThreshold from config
       │
       ├──► StatusBarProvider (v0.5) ◄─── showStatusBar from config
       │
       └──► GitService (v1.0) ──► DashboardPanelProvider (v1.0)
                                  LanguageTreeProvider (v1.0)
                                  ExportService (v1.0)
```

## Lifecycle

### Activation

```typescript
// extension.ts
export function activate(context: vscode.ExtensionContext): void {
  // 1. Create services (dependency injection via constructors)
  const config = new ConfigurationService();
  const cache = new CacheService(config);
  const classifier = new FileClassifierService(config);
  const counter = new LineCounterService(classifier, cache, config);
  const provider = new LineCountDecorationProvider(counter, classifier, cache, config);

  // 2. Register with VS Code and push to subscriptions for cleanup
  context.subscriptions.push(
    config, cache, counter, provider,
    vscode.window.registerFileDecorationProvider(provider),
    registerRefreshCommand(provider, cache),
  );
}
```

### Deactivation

All services implement `vscode.Disposable`. When VS Code deactivates the extension:
1. `context.subscriptions` are disposed in reverse order
2. Each service's `dispose()` method cleans up its resources:
   - `CacheService.dispose()`: Clears the LRU map
   - `FileDecorationProvider.dispose()`: Disposes file watchers, clears debounce timers
   - `ConfigurationService.dispose()`: Removes configuration change listener
   - `LineCounterService.dispose()`: Cancels any in-flight counting operations

No module-level state exists, so there's nothing to clean up outside of service instances.

## Cross-Cutting Concerns

### Cancellation

Long-running operations (workspace scan, large file reads) accept a `CancellationToken`:

```typescript
async function countAllFiles(
  files: vscode.Uri[],
  token: vscode.CancellationToken
): Promise<Map<string, number>> {
  const results = new Map();
  for (const file of files) {
    if (token.isCancellationRequested) break;
    results.set(file.fsPath, await countLines(file));
  }
  return results;
}
```

The refresh command creates a `CancellationTokenSource` and cancels it if:
- A new refresh is triggered before the current one completes
- The extension is deactivated

### Error Handling

Services follow a consistent error handling pattern:
- **Catch at boundaries**: Provider methods catch all errors and return `undefined`
- **Log with context**: `console.error(\`[LineCount] Error counting ${filePath}:\`, error)`
- **No user-facing errors for expected failures**: Missing files, inaccessible paths, and binary files are expected
- **User-facing errors for unexpected failures**: Extension activation failure shows a warning

### Cross-Platform

- Paths are normalized using `pathUtils.ts` (forward slashes for cache keys)
- File system operations use `vscode.Uri` where possible
- Directory separators in skip patterns use `path.sep`
- CRLF/LF line endings are both handled in line counting

## Security

### Webview CSP (v1.0)

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
    script-src 'nonce-${nonce}';
    style-src ${cspSource} 'unsafe-inline';
    font-src ${cspSource};
    img-src ${cspSource} data:;">
```

### Path Traversal Prevention

All file operations verify that the target path is within a workspace folder:

```typescript
function isWithinWorkspace(filePath: string): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return false;
  return folders.some(f => filePath.startsWith(f.uri.fsPath));
}
```

### Git Command Safety

Git commands use `execFile` (not `exec`) to prevent shell injection. See [ADR 007](./adr/007-git-integration-approach.md).

## Performance

### Targets

| Metric | Target |
|--------|--------|
| Extension activation | < 100ms (no blocking work in activate()) |
| 10,000-file workspace scan | < 10 seconds |
| Memory usage (10K files) | < 50MB |
| Single file re-count | < 50ms |

### Strategies

1. **Lazy loading**: Files are counted on-demand when VS Code requests decorations
2. **LRU cache**: Most recently accessed files stay in memory (default 10K entries)
3. **mtime+size invalidation**: Only re-count when file actually changed
4. **Debounced batch updates**: Multiple rapid changes coalesce into one update
5. **Size-based read strategy**: `readFile` for small files, streams for large files
6. **Binary file skip**: Known binary extensions are skipped immediately
7. **Cancellation**: Long-running scans can be cancelled
8. **Symlink detection**: `lstat` prevents infinite loops in symlinked directories

## Related Documents

- [ADR 001: Modular Architecture](./adr/001-modular-architecture.md)
- [ADR 002: esbuild Bundler](./adr/002-esbuild-bundler.md)
- [ADR 003: Zero Runtime Dependencies](./adr/003-zero-runtime-deps.md)
- [ADR 004: Bun Toolchain](./adr/004-bun-toolchain.md)
- [ADR 005: Comment Counting Strategy](./adr/005-comment-counting-strategy.md)
- [ADR 006: Webview React + Vite](./adr/006-webview-react-vite.md)
- [ADR 007: Git Integration](./adr/007-git-integration-approach.md)
- [Developer Guide](./developer-guide.md)
