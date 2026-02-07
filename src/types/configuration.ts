/**
 * TypeScript interface mirroring the package.json `contributes.configuration` schema.
 * Every property here has a corresponding entry in package.json.
 */
export interface LineCountConfiguration {
  /** Enable/disable line count badges in the file explorer. Default: true */
  enabled: boolean;

  /** Directories to exclude from line counting. Default: ['node_modules', '.git', ...] */
  excludeDirectories: string[];

  /** Maximum file size in bytes for exact line counting. Default: 5000000 (5MB) */
  sizeLimit: number;

  /** Debounce delay in milliseconds for badge updates. Default: 300 */
  debounceDelay: number;

  /** Line count threshold for yellow warning badge. Default: 500 */
  warningThreshold: number;

  /** Line count threshold for red error badge. Default: 1000 */
  errorThreshold: number;

  /** Show line count breakdown in the status bar. Default: true */
  showStatusBar: boolean;

  /** Badge display format: 'abbreviated' or 'exact'. Default: 'abbreviated' */
  displayFormat: 'abbreviated' | 'exact';

  /** Additional file extensions to include. Default: [] */
  includeExtensions: string[];

  /** File extensions to exclude. Default: [] */
  excludeExtensions: string[];
}

/**
 * Default configuration values matching package.json defaults.
 */
export const DEFAULT_CONFIGURATION: LineCountConfiguration = {
  enabled: true,
  excludeDirectories: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    'bin',
    'obj',
    '.vscode',
    '.idea',
    'vendor',
    'coverage',
    '.next',
    '.nuxt',
    'target',
    '.cache',
  ],
  sizeLimit: 5_000_000,
  debounceDelay: 300,
  warningThreshold: 500,
  errorThreshold: 1000,
  showStatusBar: true,
  displayFormat: 'abbreviated',
  includeExtensions: [],
  excludeExtensions: [],
};
