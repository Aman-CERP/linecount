# LineCount

**Line count badges in your VS Code file explorer** - see the size of every file at a glance.

LineCount displays line count badges next to files in the VS Code explorer, with real-time updates as you edit. Built with a modular architecture, zero runtime dependencies, and comprehensive test coverage.

[![CI](https://github.com/Aman-CERP/linecount/actions/workflows/ci.yml/badge.svg)](https://github.com/Aman-CERP/linecount/actions/workflows/ci.yml)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/AmanERP.linecount)](https://marketplace.visualstudio.com/items?itemName=AmanERP.linecount)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!-- TODO: Add screenshot here -->
<!-- ![LineCount in action](resources/images/screenshot.png) -->

## Features

### v0.1 - Core Line Counting
- **Explorer Badges**: Line count badges displayed next to every file in the explorer
- **Real-Time Updates**: Badges update automatically on file create, delete, rename, and content change
- **Smart Filtering**: Skips binary files, `node_modules`, `.git`, and other non-relevant directories
- **Large File Estimation**: Files above the configurable size limit (default 5MB) show estimated counts with "~" prefix
- **Abbreviated Display**: Counts formatted as exact numbers < 1000, "1.2K" for thousands, "1.5M" for millions
- **Manual Refresh**: Refresh button in the explorer title bar to re-count all files
- **Configurable**: Exclude directories, set size limits, adjust debounce delay, enable/disable badges

### v0.5 - Enhanced Features
- **Color-Coded Badges**: Yellow warning badges for files above 500 lines, red for 1000+ lines (configurable thresholds)
- **Status Bar**: Active file's line count with code/comment/blank breakdown
- **Comment Parsing**: Language-aware comment/blank/code line breakdown for 15+ languages
- **Workspace Summary**: Command showing total lines, files, and language breakdown with progress indicator
- **Display Format**: Choose between abbreviated (1.2K) or exact (1234) badge format
- **Extension Filtering**: Include/exclude specific file extensions

### v1.0 - Full Metrics Suite
- **Interactive Dashboard**: React-based webview with language pie chart, trend area chart, top files bar chart, and code/comment ratio visualization
- **Git Integration**: Lines added/removed since last commit, per-file change tracking
- **Per-Author Stats**: Line count aggregation by git author
- **Language Tree View**: Sidebar tree grouping files by language with aggregate counts
- **Export Reports**: Export metrics as CSV, JSON, or Markdown

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "LineCount"
4. Click Install

### From VSIX

1. Download the `.vsix` file from [Releases](https://github.com/Aman-CERP/linecount/releases)
2. In VS Code: Extensions > `...` menu > "Install from VSIX..."
3. Select the downloaded file

## Usage

Once installed, line count badges appear automatically next to files in the explorer panel.

- **Refresh Counts**: Click the refresh icon in the explorer title bar
- **View Exact Count**: Hover over a badge to see the exact line count in the tooltip
- **Workspace Summary** (v0.5+): Run "LineCount: Show Workspace Summary" from the Command Palette
- **Open Dashboard** (v1.0+): Run "LineCount: Open Dashboard" from the Command Palette
- **Export Report** (v1.0+): Run "LineCount: Export Report" from the Command Palette

## Configuration

All settings are under `linecount.*` in VS Code Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `linecount.enabled` | `true` | Enable/disable line count badges |
| `linecount.excludeDirectories` | `["node_modules", ".git", ...]` | Directories to exclude |
| `linecount.sizeLimit` | `5000000` (5MB) | Max file size for exact counting |
| `linecount.debounceDelay` | `300` | Debounce delay in ms for updates |
| `linecount.warningThreshold` | `500` | Lines threshold for yellow badge (v0.5) |
| `linecount.errorThreshold` | `1000` | Lines threshold for red badge (v0.5) |
| `linecount.showStatusBar` | `true` | Show status bar item (v0.5) |
| `linecount.displayFormat` | `"abbreviated"` | Badge format: "abbreviated" or "exact" (v0.5) |
| `linecount.includeExtensions` | `[]` | Additional extensions to include (v0.5) |
| `linecount.excludeExtensions` | `[]` | Extensions to exclude (v0.5) |

## Commands

| Command | Description |
|---------|-------------|
| `LineCount: Refresh All Counts` | Clear cache and re-count all files |
| `LineCount: Show Workspace Summary` | Display workspace-wide statistics (v0.5) |
| `LineCount: Export Report` | Export metrics as CSV/JSON/Markdown (v1.0) |
| `LineCount: Open Dashboard` | Open the interactive metrics dashboard (v1.0) |

## Architecture

LineCount uses a modular service architecture with dependency injection:

```
extension.ts (entry point, ~30 lines)
  │
  ├── ConfigurationService     (reads VS Code settings)
  ├── CacheService             (LRU cache with mtime+size invalidation)
  ├── FileClassifierService    (binary/text detection, skip logic)
  ├── LineCounterService       (core line counting)
  ├── FileDecorationProvider   (explorer badges + file watchers)
  ├── CommentParserService     (v0.5: code/comment/blank breakdown)
  ├── StatusBarProvider        (v0.5: active file stats)
  ├── GitService               (v1.0: git operations)
  ├── DashboardPanelProvider   (v1.0: React webview)
  ├── LanguageTreeProvider     (v1.0: sidebar tree)
  └── ExportService            (v1.0: report generation)
```

See [Architecture Documentation](docs/architecture.md) for detailed data flow diagrams and design decisions.

## Performance

- Extension activation does not block VS Code startup
- Files are counted lazily (on-demand when VS Code requests decorations)
- LRU cache with `{mtimeMs, size}` invalidation prevents unnecessary re-counting
- Files < 512KB use `fs.readFile`; larger files use streaming with 10s timeout
- Binary files are detected by extension and skipped immediately
- Debounced batch updates prevent UI thrashing during rapid edits
- Target: 10,000-file workspace scan in < 10 seconds, < 50MB memory

## Bugs Fixed from LineSight

LineCount is a complete rewrite of [LineSight](https://github.com/karansinghgit/linesight), fixing these critical bugs:

| Bug | LineSight Issue | LineCount Fix |
|-----|----------------|---------------|
| Shared debounce timer race condition | `refresh()` and `queueUpdate()` share one timer | Each concern owns its own `DebouncedUriQueue` |
| File change events ignored | `ignoreChangeEvents: true` | Set to `false` + listen to `onDidSaveTextDocument` |
| Cache invalidation by size only | Same-size edits leave stale counts | Invalidate on `{mtimeMs, size}` pair |
| isInitializing blocks refresh | No try-catch, flag never resets on error | CancellationToken + try/finally |
| Empty file returns 1 line | `countLinesWithReadStream` always adds 1 | Correct empty file detection |
| queueUpdate drops URIs | Debounce replaces URI instead of accumulating | `DebouncedUriQueue` accumulates in a Set |
| No user configuration | Hardcoded `DEFAULT_CONFIG` | Full `contributes.configuration` schema |

## Development

```bash
# Prerequisites: Node.js 18+, Bun
bun install
bun run build
bun run test:unit
```

See [Developer Guide](docs/developer-guide.md) for full setup, debugging, and contribution instructions.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## License

MIT License - see [LICENSE](LICENSE) for details.

Copyright (c) 2026 AmanERP
