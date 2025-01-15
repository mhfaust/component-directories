import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TemplateConfig {
  templatesDir: string;
  replacements: { [key: string]: string };
  mainTemplates: TemplateItem[];
  alternateTemplateGroups?: TemplateGroup[];
}

interface TemplateItem {
  source: string;
  target: string;
  label: string;
}

interface TemplateGroup {
  label: string;
  templates: TemplateItem[];
}

interface QuickPickTemplateItem extends vscode.QuickPickItem {
  template: TemplateItem;
}

interface GenerationResult {
  success: boolean;
  existingFiles: string[];
  addedFiles: string[];
}

function validateConfig(config: any): config is TemplateConfig {
  if (!config.templatesDir || typeof config.templatesDir !== 'string') {
    throw new Error('Missing or invalid templatesDir configuration');
  }
  if (!config.replacements || typeof config.replacements !== 'object') {
    throw new Error('Missing or invalid replacements configuration');
  }
  if (!Array.isArray(config.mainTemplates)) {
    throw new Error('Missing or invalid mainTemplates configuration');
  }
  return true;
}

async function validateTemplates(config: TemplateConfig, templatesPath: string): Promise<string[]> {
  const errors: string[] = [];
  const validateTemplate = async (template: TemplateItem) => {
    try {
      await fs.access(path.join(templatesPath, template.source));
    } catch {
      errors.push(`Template file not found: ${template.source}`);
    }
  };

  for (const template of config.mainTemplates) {
    await validateTemplate(template);
  }

  if (config.alternateTemplateGroups) {
    for (const group of config.alternateTemplateGroups) {
      for (const template of group.templates) {
        await validateTemplate(template);
      }
    }
  }

  return errors;
}

function validateReplacements(config: TemplateConfig): string[] {
  const errors: string[] = [];
  for (const [token, replacement] of Object.entries(config.replacements)) {
    if (!token.startsWith('__') || !token.endsWith('__')) {
      errors.push(`Invalid replacement token format: ${token}. Must be wrapped in __TOKEN__`);
    }
    if (typeof replacement !== 'string') {
      errors.push(`Invalid replacement value for ${token}: must be a string`);
    }
  }
  return errors;
}

async function validateFullConfig(
  config: any,
  configPath: string,
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    if (!validateConfig(config)) {
      return { isValid: false, errors: ['Invalid configuration format'] };
    }

    const replacementErrors = validateReplacements(config);
    errors.push(...replacementErrors);

    const templateErrors = await validateTemplates(
      config,
      path.join(path.dirname(configPath), config.templatesDir),
    );
    errors.push(...templateErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [(error as Error).message],
    };
  }
}

async function findConfig(
  startPath: string,
): Promise<{ config: TemplateConfig; configDir: string } | null> {
  let currentPath = startPath;

  while (currentPath !== path.dirname(currentPath)) {
    try {
      const configPath = path.join(currentPath, '.component-templates.json');
      const configContent = await fs.readFile(configPath, 'utf-8');

      let parsedConfig: any;
      try {
        parsedConfig = JSON.parse(configContent);
      } catch (parseError) {
        vscode.window.showErrorMessage(
          `Invalid component-generator config JSON in ${configPath}. Error: ${(parseError as Error).message}`,
        );
        return null;
      }

      // Validate the configuration
      const validationResult = await validateFullConfig(parsedConfig, configPath);

      if (!validationResult.isValid) {
        // Join all validation errors into a clear message
        const errorMessage = validationResult.errors.join('\n• ');

        // Show error dialog with details
        const showDetails = 'Show Details';
        const selected = await vscode.window.showErrorMessage(
          'Configuration validation failed. Click "Show Details" for more information.',
          showDetails,
        );

        if (selected === showDetails) {
          // Create and show output channel with detailed errors
          const channel = vscode.window.createOutputChannel('Component Generator');
          channel.clear();
          channel.appendLine('Component Generator Configuration Errors:');
          channel.appendLine('=======================================');
          channel.appendLine(`Config file: ${configPath}`);
          channel.appendLine('');
          channel.appendLine('Validation Errors:');
          validationResult.errors.forEach((error) => {
            channel.appendLine(`• ${error}`);
          });
          channel.show();
        }

        return null;
      }

      // If validation passed, return the config
      return {
        config: parsedConfig as TemplateConfig,
        configDir: currentPath,
      };
    } catch (error) {
      // No config found at this level, move up one directory
      currentPath = path.dirname(currentPath);
    }
  }

  vscode.window.showErrorMessage(
    'No .component-templates.json found in this directory or any parent directories.',
  );
  return null;
}

async function generateSingleFile(
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

async function generateFromTemplates(
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

interface RenameOptions {
  oldName: string;
  newName: string;
  directory: vscode.Uri;
}

async function renameComponent({ oldName, newName, directory }: RenameOptions) {
  const oldPath = path.join(directory.fsPath, oldName);
  const newPath = path.join(directory.fsPath, newName);

  // 1. Rename the directory
  await fs.rename(oldPath, newPath);

  // 2. Rename files within the directory
  const files = await fs.readdir(newPath);
  for (const file of files) {
    const oldFilePath = path.join(newPath, file);
    const newFileName = file.replace(oldName, newName);
    const newFilePath = path.join(newPath, newFileName);
    await fs.rename(oldFilePath, newFilePath);
  }

  // 3. Update file contents
  const newFiles = await fs.readdir(newPath);
  for (const file of newFiles) {
    const filePath = path.join(newPath, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const updatedContent = content.replaceAll(oldName, newName);
    await fs.writeFile(filePath, updatedContent);
  }
}

async function updateImportReferences(oldName: string, newName: string) {
  const workspaceEdit = new vscode.WorkspaceEdit();

  const files = await vscode.workspace.findFiles('**/*.{ts,tsx}', '**/node_modules/**');

  for (const file of files) {
    const document = await vscode.workspace.openTextDocument(file);
    const text = document.getText();

    // Match both default and named imports
    const importPatterns = [
      // Default import: import OldName from './OldName'
      `import\\s+(${oldName})\\s+from\\s+['"](.*/${oldName})['"]`,
      // Named import: import { OldName } from './OldName'
      `import\\s+{[^}]*\\b(${oldName})\\b[^}]*}\\s+from\\s+['"](.*/${oldName})['"]`,
    ];

    for (const pattern of importPatterns) {
      const importRegex = new RegExp(pattern, 'g');

      let match;
      while ((match = importRegex.exec(text)) !== null) {
        const importName = match[1]; // The imported variable name
        const importPath = match[2]; // The path
        const newImportPath = importPath.replace(oldName, newName);

        // First update the import path
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);

        // Keep the original import name temporarily
        const originalImportStatement = text
          .substring(match.index, match.index + match[0].length)
          .replace(importPath, newImportPath);

        workspaceEdit.replace(file, new vscode.Range(startPos, endPos), originalImportStatement);

        // Find the position of the symbol to rename
        const symbolPos = document.positionAt(match.index + match[0].indexOf(importName));

        // Then trigger a symbol rename
        const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
          'vscode.executeDocumentRenameProvider',
          document.uri,
          symbolPos,
          newName,
        );

        if (edit) {
          for (const [uri, edits] of edit.entries()) {
            edits.forEach((edit) => {
              workspaceEdit.replace(uri, edit.range, edit.newText);
            });
          }
        }
      }
    }
  }

  await vscode.workspace.applyEdit(workspaceEdit);
}

async function createAltComponent(uri: vscode.Uri) {
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
    validateInput: (value) => {
      if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) {
        return 'Component name must be in PascalCase';
      }
      return null;
    },
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

let createAltComponentDisposable = vscode.commands.registerCommand(
  'extension.createAltComponent',
  createAltComponent,
);

async function addComponentFiles(uri: vscode.Uri) {
  if (!uri || !uri.fsPath) {
    vscode.window.showErrorMessage('Please right-click a directory to add component files.');
    return;
  }

  const configResult = await findConfig(uri.fsPath);
  if (!configResult) {
    return;
  }

  const { config, configDir } = configResult;

  // Create QuickPick items array combining all templates
  const quickPickItems: (QuickPickTemplateItem | vscode.QuickPickItem)[] = [];

  // Add main templates section
  if (config.mainTemplates.length > 0) {
    quickPickItems.push({
      label: 'Main Templates',
      kind: vscode.QuickPickItemKind.Separator,
    });

    quickPickItems.push(
      ...config.mainTemplates.map((template) => ({
        label: template.label,
        template: template,
        description: path.basename(template.target),
      })),
    );
  }

  // Add alternate template groups
  if (config.alternateTemplateGroups) {
    for (const group of config.alternateTemplateGroups) {
      quickPickItems.push({
        label: group.label,
        kind: vscode.QuickPickItemKind.Separator,
      });

      quickPickItems.push(
        ...group.templates.map((template) => ({
          label: template.label,
          template: template,
          description: path.basename(template.target),
        })),
      );
    }
  }

  if (quickPickItems.length === 0) {
    vscode.window.showErrorMessage('No templates found in configuration.');
    return;
  }

  // Show multi-select QuickPick to user
  const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: 'Select files to add...',
    title: 'Add Component Files',
    canPickMany: true,
  });

  if (!selectedItems || selectedItems.length === 0) {
    return; // User cancelled or selected nothing
  }

  // Filter out any separator items and get just the templates
  const selectedTemplates = selectedItems
    .filter(
      (item): item is QuickPickTemplateItem =>
        !('kind' in item) || item.kind !== vscode.QuickPickItemKind.Separator,
    )
    .map((item) => item.template);

  const templatesPath = path.join(configDir, config.templatesDir);

  // Get component name from the directory name
  const componentName = path.basename(uri.fsPath);

  try {
    const result = await generateFromTemplates(
      componentName,
      path.dirname(uri.fsPath),
      selectedTemplates,
      templatesPath,
      config.replacements,
    );

    if (result.existingFiles.length > 0) {
      // Show warning about skipped files
      if (result.addedFiles.length === 0) {
        vscode.window.showWarningMessage(
          `No files added - all selected files already exist: ${result.existingFiles.join(', ')}`,
        );
      } else {
        vscode.window.showWarningMessage(
          `Added ${result.addedFiles.length} file(s), skipped ${result.existingFiles.length} existing file(s): ${result.existingFiles.join(', ')}`,
        );
      }
    } else if (result.addedFiles.length > 0) {
      // All files added successfully
      vscode.window.showInformationMessage(
        `Successfully added ${result.addedFiles.length} file(s) to ${componentName}!`,
      );
    } else {
      // Some other error occurred
      vscode.window.showErrorMessage('Failed to add any files to the component.');
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error adding files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Add to activate function:
let addFilesDisposable = vscode.commands.registerCommand(
  'extension.addComponentFiles',
  addComponentFiles,
);

export function activate(context: vscode.ExtensionContext) {
  let createDisposable = vscode.commands.registerCommand(
    'extension.createFullComponent',
    async (uri: vscode.Uri) => {
      if (!uri || !uri.fsPath) {
        vscode.window.showErrorMessage('Please right-click a directory to generate the component.');
        return;
      }

      const configResult = await findConfig(uri.fsPath);
      if (!configResult) {
        return;
      }

      const { config, configDir } = configResult;
      const templatesPath = path.join(configDir, config.templatesDir);

      const componentName = await vscode.window.showInputBox({
        prompt: 'Component name in PascalCase',
        placeHolder: 'e.g. MyComponent',
      });

      if (!componentName) {
        return;
      }

      try {
        await generateFromTemplates(
          componentName,
          uri.fsPath,
          config.mainTemplates,
          templatesPath,
          config.replacements,
        );
        vscode.window.showInformationMessage(`Component ${componentName} created successfully!`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error generating component: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  let renameDisposable = vscode.commands.registerCommand(
    'extension.renameReactComponent',
    async (uri: vscode.Uri) => {
      if (!uri || !uri.fsPath) {
        vscode.window.showErrorMessage('Please right-click a component directory to rename it.');
        return;
      }

      const currentName = path.basename(uri.fsPath);
      const newName = await vscode.window.showInputBox({
        prompt: 'New component name in PascalCase',
        placeHolder: 'e.g. NewComponentName',
        value: currentName,
        validateInput: (value) => {
          if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) {
            return 'Component name must be in PascalCase';
          }
          return null;
        },
      });

      if (!newName || newName === currentName) {
        return;
      }

      try {
        await renameComponent({
          oldName: currentName,
          newName,
          directory: vscode.Uri.file(path.dirname(uri.fsPath)),
        });

        await updateImportReferences(currentName, newName);

        vscode.window.showInformationMessage(
          `Successfully renamed component from ${currentName} to ${newName}`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error renaming component: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  context.subscriptions.push(createDisposable);
  context.subscriptions.push(renameDisposable);
  context.subscriptions.push(createAltComponentDisposable);
  context.subscriptions.push(addFilesDisposable);
}
