/**
 * Result of counting lines in a file.
 */
export interface LineCountResult {
  /** Total number of lines in the file */
  total: number;
  /** Whether the count is an estimate (file too large for exact counting) */
  estimated: boolean;
  /** Number of code lines (non-blank, non-comment). Available in v0.5+ */
  code?: number;
  /** Number of comment lines. Available in v0.5+ */
  comment?: number;
  /** Number of blank lines. Available in v0.5+ */
  blank?: number;
}

/**
 * Cache entry storing a line count result with file metadata for invalidation.
 */
export interface CacheEntry {
  /** The cached line count result */
  result: LineCountResult;
  /** File modification time in milliseconds (from fs.stat) */
  mtimeMs: number;
  /** File size in bytes (from fs.stat) */
  sizeBytes: number;
}

/**
 * File metadata from a single fs.stat call.
 */
export interface FileMetadata {
  /** File size in bytes */
  sizeBytes: number;
  /** File modification time in milliseconds */
  mtimeMs: number;
  /** Whether the file is a regular file (not directory, symlink, etc.) */
  isFile: boolean;
  /** Whether the entry is a symbolic link */
  isSymlink: boolean;
}

/**
 * Comment syntax definition for a programming language.
 */
export interface CommentSyntax {
  /** Line comment markers (e.g., ['//', '#']) */
  lineComment?: string[];
  /** Block comment marker pairs (e.g., [['/*', '*/']]) */
  blockComment?: [string, string][];
}

/**
 * Result of parsing comments in a file.
 */
export interface CommentParseResult {
  /** Number of code lines */
  code: number;
  /** Number of comment lines */
  comment: number;
  /** Number of blank lines */
  blank: number;
}

/**
 * Workspace summary statistics.
 */
export interface WorkspaceSummary {
  /** Total number of files counted */
  totalFiles: number;
  /** Total lines across all files */
  totalLines: number;
  /** Total code lines (v0.5+) */
  totalCode?: number;
  /** Total comment lines (v0.5+) */
  totalComments?: number;
  /** Total blank lines (v0.5+) */
  totalBlank?: number;
  /** Breakdown by language/extension */
  byExtension: Map<string, { files: number; lines: number }>;
}

/**
 * Git diff statistics for a file.
 */
export interface GitFileStat {
  /** File path relative to workspace root */
  filePath: string;
  /** Lines added since last commit */
  linesAdded: number;
  /** Lines removed since last commit */
  linesRemoved: number;
}

/**
 * Git author statistics.
 */
export interface GitAuthorStat {
  /** Author name */
  name: string;
  /** Author email */
  email: string;
  /** Total commits by this author */
  commits: number;
}

/**
 * Export format options.
 */
export type ExportFormat = 'csv' | 'json' | 'markdown';

/**
 * Data for a single file in an export report.
 */
export interface ExportFileEntry {
  /** Relative file path */
  path: string;
  /** File extension */
  extension: string;
  /** Total line count */
  lines: number;
  /** Code line count (v0.5+) */
  code?: number;
  /** Comment line count (v0.5+) */
  comments?: number;
  /** Blank line count (v0.5+) */
  blank?: number;
}
