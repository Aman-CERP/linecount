# ADR 001: Modular Service Architecture

## Status

Accepted

## Date

2026-02-07

## Context

The original LineSight extension (`karansinghgit/linesight`) is a single 613-line `extension.ts` file. This monolithic structure creates several problems:

1. **Untestable**: All logic is intertwined with VS Code APIs. There is no way to unit test line counting, caching, file classification, or formatting without launching a full VS Code instance.
2. **Shared mutable state**: Global variables (`lineCountCache`, `fileDecorations`, `fileSizeCache`, `debounceTimer`, `isInitializing`) are accessed from multiple functions, creating race conditions. The shared `debounceTimer` between `refresh()` and `queueUpdate()` means they cancel each other's scheduled work.
3. **No separation of concerns**: File classification (binary detection, skip directory logic), line counting, caching, formatting, and decoration are all mixed together.
4. **Difficult to extend**: Adding features like comment counting, status bar display, or export requires modifying the same file, increasing risk of regressions.
5. **No dependency injection**: Services are tightly coupled to their implementations, making it impossible to substitute mocks for testing.

Four independent code reviewers (Claude, GPT, Gemini, combined Gemini+Claude) all identified these structural issues as root causes of the 5 critical bugs.

## Decision

We will adopt a modular service architecture where:

- Each service is a separate file, typically under 150 lines
- Services communicate through TypeScript interfaces defined in `src/types/`
- Dependencies are injected through constructors
- All services implement `vscode.Disposable` for deterministic cleanup
- No module-level mutable state - all state lives inside service instances
- The `extension.ts` entry point is ~30 lines: create services, wire dependencies, register with VS Code

### Service Breakdown

| Service | Responsibility | Lines (est.) |
|---------|---------------|-------------|
| `ConfigurationService` | Reads and watches `vscode.workspace.getConfiguration('linecount')` | ~60 |
| `CacheService` | LRU cache with `{mtimeMs, size}` invalidation | ~100 |
| `FileClassifierService` | Binary/text detection, extension filtering, symlink detection, skip directory logic | ~80 |
| `LineCounterService` | Core line counting via `fs.readFile` or `createReadStream` | ~120 |
| `FileDecorationProvider` | VS Code `FileDecorationProvider` implementation with file watchers | ~140 |
| `CommentParserService` | Language-aware comment/blank/code parsing (v0.5) | ~150 |
| `StatusBarProvider` | Status bar item for active file (v0.5) | ~80 |
| `GitService` | Git operations via `child_process.execFile` (v1.0) | ~120 |
| `ExportService` | CSV/JSON/Markdown report generation (v1.0) | ~100 |
| `DashboardPanelProvider` | WebviewViewProvider for React dashboard (v1.0) | ~120 |
| `LanguageTreeProvider` | TreeDataProvider for language grouping (v1.0) | ~100 |

### Utility Modules

| Module | Responsibility |
|--------|---------------|
| `constants.ts` | `BINARY_EXTENSIONS`, `SKIP_DIRS`, `CODE_EXTENSIONS` as `Set<string>` |
| `formatters.ts` | `formatLineCount()`, `formatBytes()` |
| `debounce.ts` | `DebouncedUriQueue` class (each instance owns its own timer) |
| `cancellation.ts` | CancellationToken utilities for long-running operations |
| `pathUtils.ts` | Cross-platform path normalization |

## Consequences

### Positive

- **Testable**: Pure logic services (formatters, cache, classifier, counter) can be unit tested with `bun:test` without VS Code
- **Race condition fix**: Each `DebouncedUriQueue` instance owns its own timer - no shared global timer
- **Extensible**: Adding v0.5 and v1.0 features means adding new files, not modifying existing ones
- **Readable**: Each file has a single responsibility and fits on one screen
- **Maintainable**: Changes to caching don't affect counting; changes to formatting don't affect decoration
- **Learning value**: Clear architecture serves as educational reference for the AmanERP team

### Negative

- **More files**: ~15 source files instead of 1. Navigation requires IDE features (Go to Definition, etc.)
- **Indirection**: Following the flow from "VS Code requests decoration" to "line count returned" requires understanding the service graph
- **Initial overhead**: More boilerplate (interfaces, constructors, dispose methods) before writing actual logic

### Mitigations

- Architecture documentation (`docs/architecture.md`) with data flow diagrams
- Clear naming conventions (files match class names)
- The `extension.ts` entry point serves as a wiring map showing all dependencies
