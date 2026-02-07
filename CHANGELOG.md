# Changelog

All notable changes to the LineCount extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Project scaffolding with modular service architecture
- Bun-powered development toolchain
- esbuild bundler configuration
- ESLint 9 flat config + Prettier
- CI/CD workflows (GitHub Actions)
- Architecture Decision Records (ADRs 001-007)
- Comprehensive documentation (architecture, developer guide)

## [0.1.0] - TBD

### Added
- Line count badges displayed next to files in VS Code explorer
- Real-time badge updates on file create, delete, rename, and content change
- Smart directory exclusion (node_modules, .git, dist, build, etc.)
- Binary file detection and skipping via centralized extension list
- Large file estimation with "~" prefix for files above configurable size limit
- Abbreviated count display: exact < 1000, "1.2K" for thousands, "1.5M" for millions
- Manual refresh command with explorer title bar button
- User-configurable settings:
  - `linecount.enabled`: Enable/disable badges
  - `linecount.excludeDirectories`: Directories to skip
  - `linecount.sizeLimit`: Max file size for exact counting
  - `linecount.debounceDelay`: Update debounce delay

### Fixed (from LineSight)
- Shared debounce timer race condition between refresh() and queueUpdate()
- File change events ignored due to `ignoreChangeEvents: true`
- Cache invalidation checking only size, not mtime (stale counts on same-size edits)
- `isInitializing` flag stuck on error (no try-catch/finally)
- Empty files returning 1 line instead of 0
- `queueUpdate` dropping URIs on rapid updates (replaced with accumulating Set)
- No user configuration (hardcoded defaults)

### Architecture
- Modular service architecture (~15 files, each < 150 lines)
- Constructor-based dependency injection
- Zero runtime dependencies
- Comprehensive unit test suite with bun:test
- Integration tests with @vscode/test-cli

## [0.5.0] - TBD

### Added
- Color-coded badges: yellow for warning threshold (default 500 lines), red for error threshold (default 1000 lines)
- Status bar item showing active file line count with code/comment/blank breakdown
- Comment/blank/code line parsing for 15+ languages:
  - JavaScript, TypeScript, Python, Java, C/C++, C#, Go, Rust, Ruby, PHP, HTML, CSS/SCSS/LESS, Shell, SQL, YAML
- Workspace summary command (`LineCount: Show Workspace Summary`) with progress indicator
- New configuration options:
  - `linecount.warningThreshold`: Yellow badge threshold
  - `linecount.errorThreshold`: Red badge threshold
  - `linecount.showStatusBar`: Show/hide status bar
  - `linecount.displayFormat`: Abbreviated or exact badge format
  - `linecount.includeExtensions`: Additional file extensions to include
  - `linecount.excludeExtensions`: File extensions to exclude

## [1.0.0] - TBD

### Added
- Interactive React dashboard with Recharts:
  - Language distribution pie chart
  - Line count trend area chart
  - Top files bar chart
  - Code/comment ratio visualization
  - Per-author statistics table
- Git integration:
  - Lines added/removed since last commit per file
  - Per-author line count aggregation
  - Change history for trend charts
- Language aggregation tree view in sidebar
- Export reports in CSV, JSON, and Markdown formats
- Activity bar icon and dedicated sidebar panel

[Unreleased]: https://github.com/Aman-CERP/linecount/compare/v0.1.0...HEAD
[1.0.0]: https://github.com/Aman-CERP/linecount/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/Aman-CERP/linecount/compare/v0.1.0...v0.5.0
[0.1.0]: https://github.com/Aman-CERP/linecount/releases/tag/v0.1.0
