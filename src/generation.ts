import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { findConfig, TemplateItem } from './configuration';

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
  // Process target path first to check existence
  const processedTarget = template.target.replaceAll('${componentName}', componentName);
  const targetPath = path.join(targetDir, processedTarget);

  // Check if file already exists
  try {
    await fs.access(targetPath);
    return { success: false, path: processedTarget, exists: true };
  } catch {
    // File doesn't exist, proceed with generation
  }

  try {
    // Read template file
    const templateContent = await fs.readFile(path.join(templatesPath, template.source), 'utf-8');

    // Replace all tokens in content
    let processedContent = templateContent;
    for (const [token, replacement] of Object.entries(replacements)) {
      processedContent = processedContent.replaceAll(
        token,
        replacement === 'componentName' ? componentName : replacement,
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

export async function createAltComponent(uri: vscode.Uri) {
  if (!uri || !uri.fsPath) {
    vscode.window.showErrorMessage('Please right-click a directory to generate the component.');
    return;
  }

  const configResult = await findConfig(uri.fsPath);
  if (!configResult) {
    return;
  }

  const { config, configDir } = configResult;

  if (!config.alternateTemplateGroups || config.alternateTemplateGroups.length === 0) {
    vscode.window.showErrorMessage('No alternate template groups defined in configuration.');
    return;
  }

  // Create QuickPick items from template groups
  const quickPickItems = config.alternateTemplateGroups.map((group) => ({
    label: group.label,
    description: `${group.templates.length} file${group.templates.length === 1 ? '' : 's'}`,
    templateGroup: group,
  }));

  // Show QuickPick to user
  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: 'Select component type...',
    title: 'Create Component',
  });

  if (!selectedItem) {
    return; // User cancelled
  }

  // Get component name from user
  const componentName = await vscode.window.showInputBox({
    prompt: 'Component name in PascalCase',
    placeHolder: 'e.g. MyComponent',
    validateInput: (value) => validateComponentName(value, config.componentNamePattern),
  });

  if (!componentName) {
    return; // User cancelled
  }

  const templatesPath = path.join(configDir, config.templatesDir);

  try {
    await generateFromTemplates(
      componentName,
      uri.fsPath,
      selectedItem.templateGroup.templates,
      templatesPath,
      config.replacements,
    );
    vscode.window.showInformationMessage(
      `Component ${componentName} created successfully using ${selectedItem.label} template!`,
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error generating component: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function validateComponentName(name: string, pattern: string): string | null {
  if (!new RegExp(pattern).test(name)) {
    return `Component name must match pattern: ${pattern}`;
  }
  return null;
}
