import * as path from 'path';
import * as fs from 'fs/promises';
import { TemplateItem } from './configurationUtils';

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
): Promise<{ success: boolean; path: string; exists: boolean }> {
  // Process the target filename only, without directory
  const processedTarget = template.target.replaceAll('{{COMPONENT_NAME}}', componentName);

  // Always place in component directory
  const componentDir = path.join(targetDir, componentName);
  const targetPath = path.join(componentDir, processedTarget);

  try {
    await fs.access(targetPath);
    return { success: false, path: processedTarget, exists: true };
  } catch {
    // File doesn't exist, proceed with generation
  }

  try {
    const templateContent = await fs.readFile(path.join(templatesPath, template.source), 'utf-8');
    const processedContent = templateContent.replaceAll('{{COMPONENT_NAME}}', componentName);

    // Ensure component directory exists
    await fs.mkdir(componentDir, { recursive: true });

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
): Promise<GenerationResult> {
  const results = await Promise.all(
    templates.map((template) =>
      generateSingleFile(componentName, targetDir, template, templatesPath),
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
