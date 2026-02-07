# ADR 003: Zero Runtime Dependencies

## Status

Accepted

## Date

2026-02-07

## Context

VS Code extensions are distributed as `.vsix` packages. Every runtime dependency increases:

1. **Package size**: Users download the VSIX on install and updates
2. **Supply chain attack surface**: Each dependency (and its transitive dependencies) is a potential vector
3. **Compatibility risk**: Dependencies may conflict with Node.js versions shipped with VS Code
4. **License compliance burden**: Each dependency has license terms that must be audited

The original LineSight extension already had zero runtime dependencies, which was a good decision. We want to maintain this property while adding significantly more functionality (comment parsing, git integration, export, dashboard).

### Analysis of Potential Dependencies

| Feature | Typical Dependency | Our Approach | Rationale |
|---------|-------------------|--------------|-----------|
| Line counting | - | `fs.readFile` / `fs.createReadStream` | Node.js built-in |
| Comment parsing | `comment-parser`, `sloc` | Built-in state machine parser | 15 languages with <150 LOC |
| Git operations | `simple-git`, `isomorphic-git` | `child_process.execFile` | VS Code exposes git binary path |
| CSV export | `csv-writer`, `papaparse` | Manual string building | CSV is trivial to generate |
| JSON export | - | `JSON.stringify` | Built-in |
| Markdown export | - | Template strings | Simple table formatting |
| Path handling | `path-to-regexp`, `glob` | `path` module + VS Code glob API | Node.js built-in + VS Code API |
| File watching | `chokidar` | `vscode.workspace.createFileSystemWatcher` | VS Code API |
| Debouncing | `lodash.debounce` | Custom `DebouncedUriQueue` class | 40 lines, purpose-built for URI accumulation |
| Configuration | `cosmiconfig` | `vscode.workspace.getConfiguration` | VS Code API |
| LRU Cache | `lru-cache` | Custom implementation with `Map` | ~60 lines with mtime+size invalidation |

### Webview Dependencies (v1.0)

The React dashboard (v1.0) uses React, Recharts, and Vite, but these are:
- **Build-time only**: Compiled into a static JS bundle by Vite
- **In a separate `webview/package.json`**: Isolated from the extension's dependency tree
- **Not included in the extension's runtime**: The built bundle is copied to the extension's output

## Decision

We will maintain **zero runtime npm dependencies** across all phases (v0.1, v0.5, v1.0).

All functionality will be implemented using:
1. **Node.js built-in modules**: `fs`, `path`, `child_process`, `crypto`
2. **VS Code API**: File watchers, configuration, webview, tree view, commands
3. **Custom implementations**: Purpose-built for our specific use cases (LRU cache, debounce queue, comment parser)

### Design Principle

> If a feature can be implemented in under 150 lines of purpose-built code, prefer that over a general-purpose dependency.

## Consequences

### Positive

- **Minimal VSIX size**: Target < 500KB (without webview), enabling fast installs and updates
- **Zero supply chain risk**: No transitive dependencies to audit or update
- **Full control**: Every line of code is ours to modify, optimize, and debug
- **No version conflicts**: No risk of dependency version conflicts with VS Code's Node.js runtime
- **License simplicity**: Only MIT license applies
- **Learning value**: Implementing LRU cache, debounce queue, and comment parser from scratch provides educational benefit for the AmanERP team

### Negative

- **More code to maintain**: Custom implementations must be tested and maintained instead of relying on community-maintained packages
- **Potentially less robust**: Well-known libraries like `lru-cache` have been battle-tested across millions of projects
- **Feature limitations**: Our comment parser covers 15 languages vs. specialized tools that may cover 50+

### Mitigations

- Comprehensive unit tests for all custom implementations (>90% coverage target)
- Each custom module is small (<150 lines) and self-contained
- The comment parser uses a registry pattern, making it easy to add languages later
- If a custom implementation proves insufficient, we can always add a dependency later without breaking the architecture
