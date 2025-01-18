import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export interface FileOperationOptions {
  allowOverwrite?: boolean;
  createIntermediateDirectories?: boolean;
}

export const getWorkspaceRoot = () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

/**
 * Checks if the given target path is safe from path traversal attacks by ensuring it is within the workspace root.
 *
 * @param targetPath - The target path to check.
 * @param workspaceRoot - The root directory of the workspace.
 * @returns `true` if the target path is within the workspace root, `false` otherwise.
 */
export function isPathTraversalSafe(targetPath: string): boolean {
  const workspaceRoot = getWorkspaceRoot();
  const normalizedTarget = path.normalize(targetPath);
  const normalizedRoot = path.normalize(workspaceRoot);
  return normalizedTarget.startsWith(normalizedRoot);
}

/**
 * Validates that the given target path is within the workspace root and does not attempt
 * to escape it. Throws a SecurityError if the path is not safe.
 *
 * @param targetPath - The path to validate.
 * @param workspaceRoot - The root directory of the workspace.
 * @param operation - The operation being performed, used for error messaging.
 * @throws SecurityError - If the target path attempts to escape the workspace root.
 * @returns A promise that resolves if the path is valid.
 */
export async function validatePath(targetPath: string, operation: string): Promise<void> {
  if (!isPathTraversalSafe(targetPath)) {
    throw new SecurityError(
      `Security violation: ${operation} path "${targetPath}" attempts to escape workspace root`,
    );
  }
}

/**
 * Sanitizes a component name by removing any path-traversal characters or sequences.
 *
 * This function removes characters such as '/', '\', and '.' to prevent
 * potential security issues related to path traversal.
 *
 * @param name - The component name to sanitize.
 * @returns The sanitized component name.
 */
export function sanitizeComponentName(name: string): string {
  return name.replace(/[\/\\]/g, '');
}

export function sanitizeFilePath(filePath: string): string {
  return filePath.replace(/\.\.[\/\\]/g, '');
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, '');
}

export async function validateTemplatesDirectory(templatesDir: string): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const absolutePath = path.resolve(workspaceRoot, templatesDir);
  await validatePath(absolutePath, 'templates directory');

  try {
    await fs.access(absolutePath);
  } catch {
    throw new SecurityError(`Templates directory "${templatesDir}" does not exist`);
  }
}

/**
 * Reads the content of a file securely after validating the file path.
 *
 * @param filePath - The path to the file to be read.
 * @param workspaceRoot - The root directory of the workspace for path validation.
 * @param encoding - The encoding to use when reading the file. Defaults to 'utf-8'.
 * @returns A promise that resolves to the content of the file as a string.
 * @throws Will throw an error if the file path is not valid or if the file cannot be read.
 */
export async function secureReadFile(
  filePath: string,
  encoding: BufferEncoding = 'utf-8',
): Promise<string> {
  await validatePath(filePath, 'read');
  return fs.readFile(filePath, { encoding });
}

/**
 * Writes content to a file securely, ensuring that the file path is validated and intermediate directories are created if necessary.
 *
 * @param filePath - The path to the file where the content should be written.
 * @param content - The content to write to the file. Can be a string or a Buffer.
 * @param options - Optional settings for the file operation.
 * @param options.allowOverwrite - If true, allows overwriting an existing file. Defaults to false.
 * @param options.createIntermediateDirectories - If true, creates intermediate directories if they do not exist. Defaults to false.
 *
 * @throws SecurityError - If the file already exists and overwriting is not allowed.
 * @throws Error - If there is an issue with file access or writing.
 *
 * @returns A promise that resolves when the file has been written successfully.
 */
export async function secureWriteFile(
  filePath: string,
  content: string | Buffer,
  options: FileOperationOptions = {},
): Promise<void> {
  await validatePath(filePath, 'write');

  if (!options.allowOverwrite) {
    try {
      await fs.access(filePath);
      throw new SecurityError(`File "${filePath}" already exists and overwrite is not allowed`);
    } catch (error) {
      // File doesn't exist, proceed with write
      if (error instanceof SecurityError) {
        throw error;
      }
    }
  }

  if (options.createIntermediateDirectories) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  await fs.writeFile(filePath, content);
}

export async function secureRenameFile(
  oldPath: string,
  newPath: string,
  options: FileOperationOptions = {},
): Promise<void> {
  await validatePath(oldPath, 'rename source');
  await validatePath(newPath, 'rename target');

  if (!options.allowOverwrite) {
    try {
      await fs.access(newPath);
      throw new SecurityError(
        `Target path "${newPath}" already exists and overwrite is not allowed`,
      );
    } catch (error) {
      // Target doesn't exist, proceed with rename
      if (error instanceof SecurityError) {
        throw error;
      }
    }
  }

  await fs.rename(oldPath, newPath);
}

export async function secureMkdir(
  dirPath: string,
  options: FileOperationOptions = {},
): Promise<void> {
  await validatePath(dirPath, 'create directory');
  await fs.mkdir(dirPath, { recursive: options.createIntermediateDirectories });
}

export function getSecurePath(basePath: string, ...segments: string[]): string {
  // Sanitize each path segment
  const sanitizedSegments = segments.map((seg) => sanitizeComponentName(seg));
  const targetPath = path.join(basePath, ...segments);

  if (!isPathTraversalSafe(targetPath)) {
    throw new SecurityError(`Invalid path: ${targetPath}`);
  }

  return targetPath;
}
