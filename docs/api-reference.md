# LineCount API Reference

Internal API documentation for the LineCount extension. This document covers all public interfaces, services, and utilities.

> **Note**: This is an internal API reference for contributors. LineCount does not expose a public extension API.

## Table of Contents

- [Types](#types)
- [Services](#services)
- [Providers](#providers)
- [Commands](#commands)
- [Utilities](#utilities)

---

## Types

All shared types are defined in `src/types/`.

### LineCountResult

Result of counting lines in a file.

```typescript
interface LineCountResult {
  total: number;        // Total number of lines
  estimated: boolean;   // Whether the count is an estimate
  code?: number;        // Code lines (v0.5+)
  comment?: number;     // Comment lines (v0.5+)
  blank?: number;       // Blank lines (v0.5+)
}
```

### CacheEntry

Cache entry with file metadata for invalidation.

```typescript
interface CacheEntry {
  result: LineCountResult;
  mtimeMs: number;    // File modification time (ms)
  sizeBytes: number;  // File size (bytes)
}
```

### FileMetadata

File metadata from a single `fs.lstat` call.

```typescript
interface FileMetadata {
  sizeBytes: number;
  mtimeMs: number;
  isFile: boolean;
  isSymlink: boolean;
}
```

### CommentSyntax

Comment syntax definition for a programming language.

```typescript
interface CommentSyntax {
  lineComment?: string[];              // e.g., ['//', '#']
  blockComment?: [string, string][];   // e.g., [['/*', '*/']]
}
```

### CommentParseResult

Result of parsing comments in a file.

```typescript
interface CommentParseResult {
  code: number;
  comment: number;
  blank: number;
}
```

### WorkspaceSummary

Workspace-wide statistics.

```typescript
interface WorkspaceSummary {
  totalFiles: number;
  totalLines: number;
  totalCode?: number;
  totalComments?: number;
  totalBlank?: number;
  byExtension: Map<string, { files: number; lines: number }>;
}
```

### GitFileStat / GitAuthorStat

Git statistics (v1.0).

```typescript
interface GitFileStat {
  filePath: string;
  linesAdded: number;
  linesRemoved: number;
}

interface GitAuthorStat {
  name: string;
  email: string;
  commits: number;
}
```

### LineCountConfiguration

TypeScript interface mirroring `package.json` configuration schema.

```typescript
interface LineCountConfiguration {
  enabled: boolean;
  excludeDirectories: string[];
  sizeLimit: number;
  debounceDelay: number;
  warningThreshold: number;
  errorThreshold: number;
  showStatusBar: boolean;
  displayFormat: 'abbreviated' | 'exact';
  includeExtensions: string[];
  excludeExtensions: string[];
}
```

---

## Services

### ConfigurationService

**File**: `src/services/ConfigurationService.ts`
**Implements**: `vscode.Disposable`

Wraps `vscode.workspace.getConfiguration('linecount')` with typed access.

#### Constructor

```typescript
new ConfigurationService()
```

Reads initial configuration and listens for changes via `onDidChangeConfiguration`.

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get config` | `LineCountConfiguration` | Current configuration snapshot |
| `onDidChange` | `vscode.Event<LineCountConfiguration>` | Event fired when config changes |
| `dispose()` | `void` | Removes change listener |

---

### CacheService

**File**: `src/services/CacheService.ts`
**Implements**: `vscode.Disposable`

LRU cache with `{mtimeMs, sizeBytes}` invalidation. Fixes LineSight's size-only cache check.

#### Constructor

```typescript
new CacheService(config: ConfigurationService)
```

Reads `maxSize` from internal defaults (10,000 entries).

#### Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `get` | `(path: string, currentMtimeMs: number, currentSize: number)` | `LineCountResult \| undefined` | Returns cached result if metadata matches, `undefined` if stale or missing |
| `set` | `(path: string, result: LineCountResult, mtimeMs: number, sizeBytes: number)` | `void` | Stores result with metadata. Evicts LRU entry if at capacity |
| `invalidate` | `(path: string)` | `void` | Removes a specific entry |
| `clear` | `()` | `void` | Removes all entries |
| `get size` | | `number` | Current number of cached entries |
| `dispose` | `()` | `void` | Clears all entries |

---

### FileClassifierService

**File**: `src/services/FileClassifierService.ts`
**Implements**: `vscode.Disposable`

Determines whether a file should be counted, skipped, or treated as binary.

#### Constructor

```typescript
new FileClassifierService(config: ConfigurationService)
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `shouldSkip` | `(uri: vscode.Uri)` | `boolean` | Returns `true` if the file should be skipped (binary, excluded dir, etc.) |
| `isBinaryExtension` | `(ext: string)` | `boolean` | Checks if extension is in `BINARY_EXTENSIONS` set |
| `isCodeExtension` | `(ext: string)` | `boolean` | Checks if extension is in `CODE_EXTENSIONS` set or user's `includeExtensions` |
| `isExcludedDirectory` | `(filePath: string)` | `boolean` | Checks if path contains any excluded directory |
| `getFileMetadata` | `(filePath: string)` | `Promise<FileMetadata>` | Single `lstat` call returning size, mtime, isFile, isSymlink |
| `dispose` | `()` | `void` | No-op (stateless service) |

---

### LineCounterService

**File**: `src/services/LineCounterService.ts`
**Implements**: `vscode.Disposable`

Core line counting logic. Uses `fs.readFile` for files < 512KB, `fs.createReadStream` for larger files.

#### Constructor

```typescript
new LineCounterService(
  classifier: FileClassifierService,
  cache: CacheService,
  config: ConfigurationService,
)
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `countLines` | `(uri: vscode.Uri)` | `Promise<LineCountResult>` | Count lines in a file. Returns cached result if fresh. Empty file = 0. Large file = estimated |
| `countLinesInContent` | `(content: string)` | `number` | Count newlines in a string (pure function, testable) |
| `dispose` | `()` | `void` | Cancels in-flight operations |

#### Behavior

- **Empty file** (size 0): Returns `{ total: 0, estimated: false }`
- **File > sizeLimit**: Returns `{ total: estimated, estimated: true }`
- **File < 512KB**: `fs.readFile` + newline counting
- **File >= 512KB**: `fs.createReadStream` with 128KB chunks, 10s timeout
- **CRLF handling**: `\r\n` counts as one line, not two
- **No trailing newline**: Last line is still counted

---

### CommentParserService (v0.5)

**File**: `src/services/CommentParserService.ts`

State machine parser for classifying lines as code, comment, or blank.

#### Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `parse` | `(content: string, extension: string)` | `CommentParseResult` | Parse content and classify each line |
| `getSyntax` | `(extension: string)` | `CommentSyntax \| undefined` | Get comment syntax for a file extension |

#### Supported Languages

JavaScript/TypeScript, Python, Java, C/C++, C#, Go, Rust, Ruby, PHP, HTML, CSS/SCSS/LESS, Shell, SQL, YAML, Markdown.

See [ADR 005](adr/005-comment-counting-strategy.md) for parsing strategy.

---

### GitService (v1.0)

**File**: `src/services/GitService.ts`
**Implements**: `vscode.Disposable`

Git operations via `child_process.execFile`.

#### Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `isGitRepo` | `(cwd: string)` | `Promise<boolean>` | Check if directory is inside a git repo |
| `getFileStats` | `(cwd: string)` | `Promise<GitFileStat[]>` | Get lines added/removed per file since HEAD |
| `getAuthorStats` | `(cwd: string)` | `Promise<GitAuthorStat[]>` | Get commit counts per author |
| `dispose` | `()` | `void` | Clears cache |

See [ADR 007](adr/007-git-integration-approach.md) for approach details.

---

### ExportService (v1.0)

**File**: `src/services/ExportService.ts`

Generates reports in CSV, JSON, or Markdown format.

#### Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `export` | `(entries: ExportFileEntry[], format: ExportFormat)` | `string` | Generate report content |
| `exportToFile` | `(entries: ExportFileEntry[], format: ExportFormat)` | `Promise<void>` | Show save dialog and write file |

---

## Providers

### LineCountDecorationProvider

**File**: `src/providers/FileDecorationProvider.ts`
**Implements**: `vscode.FileDecorationProvider`, `vscode.Disposable`

Provides line count badges in the VS Code file explorer.

#### Constructor

```typescript
new LineCountDecorationProvider(
  counter: LineCounterService,
  classifier: FileClassifierService,
  cache: CacheService,
  config: ConfigurationService,
)
```

#### VS Code Interface

| Method | Parameters | Returns |
|--------|-----------|---------|
| `provideFileDecoration` | `(uri: vscode.Uri, token: vscode.CancellationToken)` | `Promise<vscode.FileDecoration \| undefined>` |
| `onDidChangeFileDecorations` | | `vscode.Event<vscode.Uri \| vscode.Uri[]>` |

#### Custom Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `refresh` | `(uris?: vscode.Uri[])` | `void` | Invalidate cache and re-fire decoration events |
| `refreshAll` | `()` | `void` | Clear all caches and re-fire for all files |
| `dispose` | `()` | `void` | Dispose watchers, timers, event emitters |

#### File Watchers

The provider sets up:
1. `FileSystemWatcher` with `ignoreChangeEvents: false` (fixes LineSight bug)
2. `onDidSaveTextDocument` listener for immediate save feedback
3. `onDidChangeWorkspaceFolders` listener for multi-root workspace support

Each event source feeds into its own `DebouncedUriQueue` instance (fixes shared timer race condition).

---

### StatusBarProvider (v0.5)

**File**: `src/providers/StatusBarProvider.ts`
**Implements**: `vscode.Disposable`

Status bar item showing active file's line breakdown.

#### Display Format

```
$(list-ordered) 142 lines (120 code, 15 comments, 7 blank)
```

#### Events

Updates on:
- `onDidChangeActiveTextEditor`
- `onDidSaveTextDocument`

---

### DashboardPanelProvider (v1.0)

**File**: `src/providers/DashboardPanelProvider.ts`
**Implements**: `vscode.WebviewViewProvider`, `vscode.Disposable`

Hosts the React dashboard in a webview panel.

#### Message Protocol

**Extension -> Webview:**
```typescript
{ type: 'update', data: { languages: [...], topFiles: [...], authors: [...], trends: [...] } }
```

**Webview -> Extension:**
```typescript
{ type: 'refresh' }
{ type: 'export', format: 'csv' | 'json' | 'markdown' }
```

---

### LanguageTreeProvider (v1.0)

**File**: `src/providers/LanguageTreeProvider.ts`
**Implements**: `vscode.TreeDataProvider<LanguageTreeItem>`, `vscode.Disposable`

Tree view grouping files by language with aggregate counts.

#### Structure

```
JavaScript (3,450 lines, 12 files)
  ├── src/app.js (1,200 lines)
  ├── src/utils.js (850 lines)
  └── ...
Python (2,100 lines, 8 files)
  └── ...
```

---

## Commands

### linecount.refresh

**File**: `src/commands/refreshCommand.ts`

Clears all caches and re-counts all files.

```typescript
function registerRefreshCommand(
  provider: LineCountDecorationProvider,
  cache: CacheService,
): vscode.Disposable
```

### linecount.showSummary (v0.5)

**File**: `src/commands/summaryCommand.ts`

Shows workspace summary with progress indicator.

### linecount.exportReport (v1.0)

**File**: `src/commands/exportCommand.ts`

Prompts for format (CSV/JSON/Markdown), then generates and saves report.

---

## Utilities

### formatters.ts

| Function | Signature | Description |
|----------|-----------|-------------|
| `formatLineCount` | `(count: number) => string` | Format: 0, 42, 999, "1K", "1.5K", "2.3M" |
| `formatBytes` | `(bytes: number) => string` | Format: "0 B", "1.2 KB", "3.4 MB" |

### constants.ts

| Constant | Type | Description |
|----------|------|-------------|
| `BINARY_EXTENSIONS` | `Set<string>` | File extensions to skip (`.exe`, `.png`, etc.) |
| `SKIP_DIRS` | `Set<string>` | Default directories to exclude |
| `CODE_EXTENSIONS` | `Set<string>` | Known code file extensions |
| `COMMENT_SYNTAX` | `Record<string, CommentSyntax>` | Comment syntax per extension (v0.5) |

### debounce.ts

```typescript
class DebouncedUriQueue implements vscode.Disposable {
  constructor(callback: (uris: vscode.Uri[]) => void, delay: number)
  add(uri: vscode.Uri): void       // Accumulates URI, resets timer
  flush(): void                      // Immediately process all accumulated URIs
  dispose(): void                    // Clear timer, clear queue
}
```

Key design: Each instance owns its own timer and URI accumulation set. No shared global state.

### cancellation.ts

Utilities for creating and managing `vscode.CancellationToken` instances with timeout support.

### pathUtils.ts

| Function | Signature | Description |
|----------|-----------|-------------|
| `normalizePath` | `(filePath: string) => string` | Normalize to forward slashes for cache keys |
| `isWithinWorkspace` | `(filePath: string) => boolean` | Check if path is within workspace bounds |
| `getRelativePath` | `(filePath: string, workspaceRoot: string) => string` | Get workspace-relative path |
