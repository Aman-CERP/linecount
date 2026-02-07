# ADR 007: Git Integration via child_process.execFile

## Status

Accepted (for v1.0 implementation)

## Date

2026-02-07

## Context

Version 1.0 adds git-aware statistics:
- Lines added/removed since last commit per file
- Per-author line count aggregation
- Change history for trend charts

These features require executing git commands against the workspace repository.

### Approaches Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| **`child_process.exec`** | Simple, shell features available | **Shell injection vulnerability**, shell overhead |
| **`child_process.execFile`** | No shell injection, direct binary exec | Must pass args as array, no shell features (pipes, globbing) |
| **`simple-git` npm package** | High-level API, well-tested | Runtime dependency (violates ADR 003) |
| **`isomorphic-git`** | Pure JS git implementation | Large dependency (~1MB), slower than native git |
| **VS Code Git Extension API** | Official, already available | Limited API surface, not all git commands exposed |

### Security Consideration: exec vs execFile

```javascript
// DANGEROUS - shell injection possible
exec(`git log --author="${userInput}"`, callback);
// If userInput is: "; rm -rf /"  -> catastrophic

// SAFE - no shell involved
execFile('git', ['log', `--author=${userInput}`], callback);
// userInput is passed as a literal argument, no shell interpretation
```

`child_process.execFile` does **not** spawn a shell. It directly invokes the binary with the given arguments array. This eliminates shell injection as an attack vector entirely.

### Getting the Git Binary Path

VS Code ships with a built-in git extension that provides the path to the git binary:

```typescript
const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
const api = gitExtension?.exports.getAPI(1);
const gitPath = api?.git.path;  // e.g., '/usr/bin/git' or 'C:\\Program Files\\Git\\cmd\\git.exe'
```

This is more reliable than assuming `git` is on the system PATH, especially on Windows.

## Decision

We will use **`child_process.execFile`** to execute git commands, obtaining the git binary path from VS Code's built-in git extension.

### GitService Design

```typescript
class GitService implements vscode.Disposable {
  private gitPath: string | undefined;
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initGitPath();
  }

  private async initGitPath(): Promise<void> {
    const gitExt = vscode.extensions.getExtension('vscode.git');
    if (gitExt) {
      const api = gitExt.exports.getAPI(1);
      this.gitPath = api?.git?.path ?? 'git';
    }
  }

  private async exec(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.gitPath ?? 'git',
        args,
        { cwd, timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        }
      );
    });
  }
}
```

### Git Commands Used

| Feature | Command | Output |
|---------|---------|--------|
| File change stats | `git diff --numstat HEAD` | `added\tremoved\tfilename` per line |
| Per-author stats | `git shortlog -sne HEAD` | `count\tname <email>` per line |
| File history | `git log --numstat --format=%H:%an:%ae:%at -- <file>` | Commit + stats |
| Check if repo | `git rev-parse --is-inside-work-tree` | `true` or error |
| Root directory | `git rev-parse --show-toplevel` | Absolute path |

### Caching Strategy

Git commands can be expensive for large repositories. We implement:

1. **5-minute TTL cache**: Results are cached with a timestamp. Stale entries are re-fetched.
2. **Cache key**: `command + args + cwd` concatenated
3. **Cache invalidation**: The refresh command clears the git cache along with the line count cache
4. **Background refresh**: Git stats are fetched asynchronously and displayed when available

### Timeout and Resource Limits

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `timeout` | 30 seconds | Prevents hanging on large repos or network git operations |
| `maxBuffer` | 10MB | Accommodates large `git log` output for repos with thousands of files |
| Concurrency | 1 git command at a time | Prevents overwhelming the git process |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| No git repo | GitService returns empty results, features gracefully hidden |
| Git not installed | `gitPath` fallback to `'git'`, error caught, features disabled |
| Command timeout | Promise rejects, cached stale data returned if available |
| Detached HEAD | `git diff --numstat HEAD` still works (compares to HEAD) |
| Shallow clone | `git shortlog` may have limited history; we accept this limitation |

## Consequences

### Positive

- **Zero dependencies**: No `simple-git` or `isomorphic-git` needed
- **Security**: `execFile` prevents shell injection entirely
- **Reliable git path**: Using VS Code's git extension API works across all platforms
- **Performance**: Native git binary is faster than any JavaScript git implementation
- **Timeout protection**: 30-second timeout prevents hangs
- **Graceful degradation**: If git is unavailable, the extension works without git features

### Negative

- **Git binary required**: Users without git installed lose git features (but this is rare for VS Code users)
- **Output parsing**: Must parse git command output manually (fragile if git output format changes)
- **Platform differences**: Git output may differ slightly between Windows and Unix (line endings, path separators)
- **Process spawning overhead**: Each git command spawns a child process

### Mitigations

- Git output formats used (`--numstat`, `--format`) are stable and well-documented
- Cross-platform path normalization (ADR 001's `pathUtils.ts`) handles separator differences
- Caching (5-minute TTL) reduces the number of git commands executed
- Unit tests mock `execFile` to test parsing logic without requiring git
- Integration tests run in a real git repo to verify end-to-end behavior

## References

- [Node.js child_process.execFile](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback)
- [VS Code Git Extension API](https://github.com/microsoft/vscode/tree/main/extensions/git)
- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
