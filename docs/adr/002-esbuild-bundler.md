# ADR 002: esbuild for Extension Bundling

## Status

Accepted

## Date

2026-02-07

## Context

VS Code extensions need to be packaged into a single JavaScript bundle for distribution. The original LineSight extension uses `tsc` (TypeScript compiler) directly, outputting individual `.js` files to an `out/` directory. This approach has drawbacks:

1. **Multiple files shipped**: Every `.ts` file becomes a separate `.js` file, increasing VSIX size and load time
2. **No tree shaking**: Unused exports are included in the output
3. **No minification**: Output is human-readable, increasing package size
4. **Slow builds**: `tsc` is not optimized for bundling speed

We evaluated three bundling options:

| Bundler | Build Speed | Config Complexity | VS Code Support | Tree Shaking |
|---------|------------|-------------------|-----------------|-------------|
| **esbuild** | ~50ms | Minimal (JS API) | Official recommendation | Yes |
| **webpack** | ~2-5s | Complex (webpack.config.js + ts-loader) | Legacy default | Yes |
| **rollup** | ~1-2s | Moderate | Community plugins | Yes |

## Decision

We will use **esbuild** as our bundler for the extension.

### Configuration

```javascript
// esbuild.js
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],       // vscode module provided by runtime
  format: 'cjs',              // VS Code extension host requires CommonJS
  platform: 'node',           // Extensions run in Node.js
  target: 'node18',           // Minimum Node.js version
  sourcemap: !production,     // Sourcemaps in dev only
  minify: production,         // Minify for production builds
  treeShaking: true,          // Remove unused code
};
```

### Key Choices

1. **`external: ['vscode']`**: The `vscode` module is provided by the VS Code extension host at runtime and must not be bundled
2. **`format: 'cjs'`**: VS Code's extension host uses CommonJS module loading. ESM is not yet supported
3. **`platform: 'node'`**: Extensions run in a Node.js process, not the browser
4. **`target: 'node18'`**: Matches our minimum Node.js requirement
5. **Output to `dist/`**: Clean separation from `tsc` output (`out/`), which we keep for type checking only
6. **Sourcemaps in dev only**: Production builds are smaller without sourcemaps

### Build Scripts

```json
{
  "build": "bun esbuild.js",
  "build:prod": "bun esbuild.js --production",
  "watch": "bun esbuild.js --watch"
}
```

The `--watch` flag uses esbuild's incremental rebuild, which rebuilds in <10ms on file changes.

## Consequences

### Positive

- **Sub-second builds**: Full production build completes in ~50-100ms
- **Single output file**: `dist/extension.js` is one file, reducing VSIX size and improving load time
- **Tree shaking**: Dead code from utility modules is eliminated
- **Minification**: Production bundle is significantly smaller
- **Official recommendation**: esbuild is recommended by the VS Code extension development docs (as of 2025+)
- **Simple configuration**: ~30 lines of JavaScript vs. 100+ lines of webpack config

### Negative

- **No type checking**: esbuild strips types but doesn't validate them. We mitigate this by running `tsc --noEmit` separately in CI
- **CJS only**: esbuild can't produce ESM for VS Code extensions (this is a VS Code limitation, not esbuild's)
- **Node.js required**: esbuild itself runs on Node.js (not Bun), though we invoke it via `bun esbuild.js`

### Mitigations

- `tsc --noEmit` runs as the `compile` script for type checking
- CI pipeline runs both `compile` (type check) and `build:prod` (bundle) as separate steps
- The `tsconfig.json` `noEmit` flag is not set globally - it's used only via the `compile` script, allowing `tsc` to still serve as the language service for IDE features
