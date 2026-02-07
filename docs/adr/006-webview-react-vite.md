# ADR 006: React + Vite for Webview Dashboard

## Status

Accepted (for v1.0 implementation)

## Date

2026-02-07

## Context

Version 1.0 introduces an interactive dashboard displaying code metrics through charts:
- Language distribution pie chart
- Line count trend area chart
- Top files by line count bar chart
- Code/comment ratio visualization
- Per-author line count table

This dashboard will be rendered inside a VS Code webview panel.

### Webview Technology Options

| Option | Pros | Cons |
|--------|------|------|
| **Plain HTML/JS** | No build step, smallest size | No component model, manual DOM manipulation, hard to maintain charts |
| **@vscode/webview-ui-toolkit** | Official VS Code styling | **Deprecated January 2025**, no longer maintained |
| **Svelte** | Small bundle, compiled away | Smaller ecosystem for charting libraries |
| **React + Vite** | Huge ecosystem, Recharts library, HMR in dev | Larger bundle (~40KB gzipped React), build step |
| **Preact** | React-compatible, 3KB | Some Recharts compatibility issues |

### Why Not @vscode/webview-ui-toolkit

Microsoft officially deprecated `@vscode/webview-ui-toolkit` in January 2025 ([announcement](https://github.com/microsoft/vscode-webview-ui-toolkit/issues/561)). Their recommendation is to use VS Code's built-in CSS variables for theming and any modern framework for component structure.

### Charting Library Options

| Library | Size (gzipped) | React Required | Features |
|---------|---------------|----------------|----------|
| **Recharts** | ~50KB | Yes | Declarative, composable, good defaults |
| **Chart.js** | ~25KB | No (react-chartjs-2 adapter) | Canvas-based, performant |
| **D3** | ~30KB | No | Maximum flexibility, steep learning curve |
| **Nivo** | ~80KB | Yes | Beautiful defaults, heavy |

## Decision

We will use **React 18 + Vite + Recharts** for the webview dashboard.

### Architecture

```
webview/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root component, message handling
│   ├── components/
│   │   ├── LanguagePieChart.tsx
│   │   ├── LinesTrendChart.tsx
│   │   ├── TopFilesBarChart.tsx
│   │   ├── CodeCommentRatio.tsx
│   │   └── AuthorTable.tsx
│   ├── hooks/
│   │   └── useVSCodeApi.ts   # VS Code webview API bridge
│   └── styles/
│       └── vscode-theme.css  # VS Code CSS variable mappings
├── vite.config.ts
├── tsconfig.json
├── index.html
└── package.json              # Separate from extension package.json
```

### Separate Package

The webview has its own `package.json` with React, Recharts, and Vite as dependencies. These are:
- **Build-time only**: Vite compiles everything into a static bundle
- **Not shipped in the VSIX**: Only the compiled `webview/dist/` output is included
- **Isolated**: No dependency conflicts with the extension's devDependencies

### VS Code Integration

The `DashboardPanelProvider` (extension side) implements `vscode.WebviewViewProvider`:

1. Sets Content Security Policy (CSP) with a nonce for inline scripts
2. Loads the compiled React bundle using `webview.asWebviewUri()`
3. Communicates with the webview via `postMessage` / `onDidReceiveMessage`

```typescript
// CSP header
const csp = [
  `default-src 'none'`,
  `script-src 'nonce-${nonce}'`,
  `style-src ${webview.cspSource} 'unsafe-inline'`,
  `font-src ${webview.cspSource}`,
  `img-src ${webview.cspSource} data:`,
].join('; ');
```

### Theming

Instead of the deprecated webview-ui-toolkit, we use VS Code's built-in CSS variables:

```css
/* vscode-theme.css */
:root {
  --bg-primary: var(--vscode-editor-background);
  --text-primary: var(--vscode-editor-foreground);
  --border: var(--vscode-panel-border);
  --accent: var(--vscode-focusBorder);
  --chart-1: var(--vscode-charts-blue);
  --chart-2: var(--vscode-charts-green);
  /* ... */
}
```

This ensures the dashboard matches the user's VS Code theme (light, dark, high contrast) automatically.

### Build Pipeline

```json
// webview/vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'webview.js',
        assetFileNames: 'webview.[ext]',
      },
    },
  },
});
```

The extension's build script copies `webview/dist/` to the VSIX package.

## Consequences

### Positive

- **Rich charting**: Recharts provides declarative, responsive charts with minimal code
- **Component model**: React's component system makes the dashboard maintainable
- **HMR in development**: Vite provides instant hot module replacement for rapid iteration
- **Theme compliance**: VS Code CSS variables ensure the dashboard looks native in all themes
- **Security**: CSP with nonce prevents XSS in the webview

### Negative

- **Bundle size**: React + Recharts adds ~90KB gzipped to the VSIX
- **Build complexity**: Two build pipelines (esbuild for extension, Vite for webview)
- **Separate package.json**: Contributors must run `bun install` in both root and `webview/`

### Mitigations

- Vite's tree shaking and minification minimize the webview bundle size
- Build scripts orchestrate both builds seamlessly (`bun run build` handles both)
- The developer guide documents the dual-build setup
- VSIX size target is relaxed to <1MB for v1.0 (from <500KB for v0.1) to accommodate the webview

## References

- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [webview-ui-toolkit deprecation](https://github.com/microsoft/vscode-webview-ui-toolkit/issues/561)
- [VS Code CSS Variables](https://code.visualstudio.com/api/references/theme-color)
- [Recharts](https://recharts.org/)
- [Vite](https://vitejs.dev/)
