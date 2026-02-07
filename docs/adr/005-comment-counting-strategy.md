# ADR 005: Bundled Comment Syntax Registry for Language-Aware Counting

## Status

Accepted (for v0.5 implementation)

## Date

2026-02-07

## Context

Version 0.5 introduces comment/blank/code line breakdown. This requires understanding the comment syntax of each programming language to classify each line as:

- **Code**: Contains executable/meaningful code
- **Comment**: Contains only comment content (single-line or within a block comment)
- **Blank**: Empty or whitespace-only

### Approaches Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| **VS Code Language API** (TextMate grammars) | Accurate, supports all installed languages | Requires document to be open, async, depends on installed extensions |
| **Tree-sitter parsing** | Most accurate AST-based analysis | Heavy dependency (~5MB), complex integration |
| **External tool** (`cloc`, `scc`, `sloc`) | Battle-tested, many languages | Runtime dependency, subprocess overhead per file |
| **Bundled syntax registry** | Zero dependencies, fast, predictable | Must manually define syntax per language, less accurate for edge cases |

### Edge Cases to Consider

1. **String literals containing comment markers**: `"// not a comment"` should be code, not a comment
2. **Multi-language files**: HTML with `<script>` and `<style>` blocks
3. **Heredocs/template literals**: May span multiple lines with mixed content
4. **Conditional compilation**: `#ifdef` in C/C++ is code, not a comment
5. **Docstrings**: Python `"""docstring"""` is semantically a comment but syntactically a string

## Decision

We will implement a **bundled comment syntax registry** with a **state machine parser**.

### Architecture

```typescript
interface CommentSyntax {
  lineComment?: string[];      // e.g., ['//', '#']
  blockComment?: [string, string][];  // e.g., [['/*', '*/']]
}

// Registry maps file extension -> comment syntax
const COMMENT_SYNTAX: Record<string, CommentSyntax> = {
  '.js': { lineComment: ['//'], blockComment: [['/*', '*/']] },
  '.py': { lineComment: ['#'], blockComment: [["'''", "'''"], ['"""', '"""']] },
  // ... 13+ more languages
};
```

### Supported Languages (v0.5)

| Language | Extensions | Line Comment | Block Comment |
|----------|-----------|-------------|---------------|
| JavaScript/TypeScript | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` | `//` | `/* */` |
| Python | `.py`, `.pyw` | `#` | `''' '''`, `""" """` |
| Java | `.java` | `//` | `/* */` |
| C/C++ | `.c`, `.h`, `.cpp`, `.hpp`, `.cc`, `.cxx` | `//` | `/* */` |
| C# | `.cs` | `//` | `/* */` |
| Go | `.go` | `//` | `/* */` |
| Rust | `.rs` | `//` | `/* */` |
| Ruby | `.rb` | `#` | `=begin =end` |
| PHP | `.php` | `//`, `#` | `/* */` |
| HTML | `.html`, `.htm` | - | `<!-- -->` |
| CSS/SCSS/LESS | `.css`, `.scss`, `.less` | `//` (SCSS/LESS) | `/* */` |
| Shell/Bash | `.sh`, `.bash`, `.zsh` | `#` | - |
| SQL | `.sql` | `--` | `/* */` |
| YAML | `.yaml`, `.yml` | `#` | - |
| Markdown | `.md` | - | `<!-- -->` |

### Parser Design

The `CommentParserService` uses a simple state machine:

```
State: NORMAL | IN_BLOCK_COMMENT
```

For each line:
1. Trim whitespace
2. If empty -> blank
3. If in `IN_BLOCK_COMMENT` state:
   - Check for block comment end marker
   - Line is a comment
4. If in `NORMAL` state:
   - Check if line starts with a line comment marker -> comment
   - Check if line starts with a block comment start marker -> comment, enter `IN_BLOCK_COMMENT`
   - Otherwise -> code

### Simplifications (Intentional)

We deliberately accept these simplifications for v0.5:

1. **No string literal awareness**: `"// this"` will be counted as code (correct by accident since the line starts with `"`, not `//`)
2. **No mixed lines**: A line with both code and a trailing comment (`x = 1; // set x`) is classified as **code** (the dominant content)
3. **No heredoc handling**: Heredoc content is treated as code lines
4. **Python docstrings as block comments**: We treat `"""..."""` as block comments, which is close enough for metrics purposes
5. **No nested block comments**: Rust supports `/* /* */ */` but we don't track nesting depth

### Fallback Behavior

For files with unrecognized extensions:
- All non-blank lines are classified as **code**
- This is a safe default that doesn't mislead users

## Consequences

### Positive

- **Zero dependencies**: No external parser or grammar files needed
- **Fast**: Simple string operations, no AST construction. Processes ~100K lines/second
- **Predictable**: Same file always produces the same result regardless of installed VS Code extensions
- **Extensible**: Adding a new language is one entry in the `COMMENT_SYNTAX` registry
- **Testable**: Pure function, easy to test with fixture files

### Negative

- **Limited accuracy**: Edge cases (string literals with comment markers, mixed code+comment lines) are handled with heuristics
- **Manual maintenance**: New languages must be manually added to the registry
- **No semantic understanding**: Can't distinguish between documentation comments and implementation comments

### Mitigations

- Test suite includes edge case fixtures (string literals with `//`, nested comments, etc.) to document known behavior
- The registry is a simple data structure that can be extended by contributors
- Accuracy is "good enough" for the use case of showing approximate code/comment ratios in badges and dashboards
- For users who need exact counts, we can recommend tools like `cloc` or `scc`

## References

- [cloc language definitions](https://github.com/AlDanial/cloc#recognized-languages-)
- [scc language database](https://github.com/boyter/scc/blob/master/languages.json)
- [VS Code Language Identifiers](https://code.visualstudio.com/docs/languages/identifiers)
