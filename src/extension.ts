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

async function findConfig(
  startPath: string,
): Promise<{ config: TemplateConfig; configDir: string } | null> {
  let currentPath = startPath;

  //Search the current path, upward, to find a template-config.
  while (currentPath !== path.dirname(currentPath)) {
    try {
      const configPath = path.join(currentPath, '.component-templates.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      return {
        config: JSON.parse(configContent),
        configDir: currentPath, // We'll need this to resolve relative template paths
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
): Promise<void> {
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

  // Process target path
  const processedTarget = template.target.replaceAll('${componentName}', componentName);
  const targetPath = path.join(targetDir, processedTarget);

  // Ensure directory exists
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  // Write file
  await fs.writeFile(targetPath, processedContent);
}

// New function to generate files from a template group
async function generateFromTemplates(
  componentName: string,
  targetDir: string,
  templates: TemplateItem[],
  templatesPath: string,
  replacements: { [key: string]: string },
): Promise<void> {
  for (const template of templates) {
    await generateSingleFile(componentName, targetDir, template, templatesPath, replacements);
  }
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
}
