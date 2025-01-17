import * as path from 'path';
import * as fs from 'fs/promises';
import { findConfig, TemplateItem } from './configurationUtils';

interface GenerationResult {
  success: boolean;
  existingFiles: string[];
  addedFiles: string[];
}

export async function generateSingleFile(
  componentName: string,
  targetDir: string,
  template: TemplateItem,
  templatesPath: string,
  replacements: { [key: string]: string },
): Promise<{ success: boolean; path: string; exists: boolean }> {
  const processedTarget = template.target.replaceAll('{{componentName}}', componentName);
  const targetPath = path.join(targetDir, processedTarget);

  try {
    await fs.access(targetPath);
    return { success: false, path: processedTarget, exists: true };
  } catch {
    // File doesn't exist, just proceed with generation of
  }

  try {
    const templateContent = await fs.readFile(path.join(templatesPath, template.source), 'utf-8');

    let processedContent = templateContent;
    for (const [token, replacement] of Object.entries(replacements)) {
      processedContent = processedContent.replaceAll(
        token,
        replacement === '{{componentName}}' ? componentName : replacement,
      );
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Write file
    await fs.writeFile(targetPath, processedContent);
    return { success: true, path: processedTarget, exists: false };
  } catch (error) {
    return { success: false, path: processedTarget, exists: false };
  }
}

export async function generateFromTemplates(
  componentName: string,
  targetDir: string,
  templates: TemplateItem[],
  templatesPath: string,
  replacements: { [key: string]: string },
): Promise<GenerationResult> {
  const results = await Promise.all(
    templates.map((template) =>
      generateSingleFile(componentName, targetDir, template, templatesPath, replacements),
    ),
  );
  const existingFiles = results.filter((r) => r.exists).map((r) => r.path);
  const addedFiles = results.filter((r) => r.success).map((r) => r.path);
  const anySuccess = results.some((r) => r.success);

  return {
    success: anySuccess,
    existingFiles,
    addedFiles,
  };
}
