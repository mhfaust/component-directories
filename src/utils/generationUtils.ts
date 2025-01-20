import * as path from 'path';
import * as fs from 'fs/promises';
import { TemplateItem } from './configurationUtils';
import { transform, CaseType, detectCase } from './caseUtils';

interface GenerationResult {
  success: boolean;
  existingFiles: string[];
  addedFiles: string[];
}

interface CaseTransformPattern {
  token: string;
  targetCase: CaseType;
}

// Common case transform patterns
const TOKEN_TRANSFORMS: CaseTransformPattern[] = [
  { token: '{{PascalCaseComponentName}}', targetCase: 'pascal' },
  { token: '{{snake_case_component_name}}', targetCase: 'snake' },
  { token: '{{kebab-case-component-name}}', targetCase: 'kebab' },
  { token: '{{camelCaseComponentName}}', targetCase: 'camel' },
];

function processTokens(input: string, componentName: string): string {
  let result = input;

  // Process each token type
  for (const { token, targetCase } of TOKEN_TRANSFORMS) {
    if (result.includes(token)) {
      const transformed = transform(componentName, targetCase);
      if (transformed) {
        result = result.replaceAll(token, transformed);
      }
    }
  }

  return result;
}

export async function generateSingleFile(
  componentName: string,
  targetDirectory: string,
  template: TemplateItem,
  templatesPath: string,
): Promise<{ success: boolean; path: string; exists: boolean }> {
  // First detect the input case - if invalid, this will return null
  const sourceCase = detectCase(componentName);
  if (!sourceCase) {
    throw new Error(`Invalid component name format: ${componentName}`);
  }

  // Process the target filename with case transformations
  const processedTarget = processTokens(template.target, componentName);
  const componentDir = path.join(targetDirectory, componentName);
  const targetPath = path.join(componentDir, processedTarget);

  try {
    await fs.access(targetPath);
    return { success: false, path: processedTarget, exists: true };
  } catch {
    // File doesn't exist, proceed with generation
  }

  try {
    const templateContent = await fs.readFile(path.join(templatesPath, template.source), 'utf-8');
    const processedContent = processTokens(templateContent, componentName);

    await fs.mkdir(componentDir, { recursive: true });
    await fs.writeFile(targetPath, processedContent);
    return { success: true, path: processedTarget, exists: false };
  } catch (error) {
    return { success: false, path: processedTarget, exists: false };
  }
}

function findTemplateItem(templateSource: string, templates: TemplateItem[]): TemplateItem {
  const template = templates.find((t) => t.source === templateSource);
  if (!template) {
    throw new Error(`Template not found: ${templateSource}`);
  }
  return template;
}

export async function generateFromTemplates(
  componentName: string,
  targetDirectory: string,
  templateSources: string[],
  templateItems: TemplateItem[],
  templatesPath: string,
): Promise<GenerationResult> {
  const templates = templateSources.map((source) => findTemplateItem(source, templateItems));

  const results = await Promise.all(
    templates.map((template) =>
      generateSingleFile(componentName, targetDirectory, template, templatesPath),
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
