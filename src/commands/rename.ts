import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { findConfig, validateComponentName } from '../utils/configurationUtils';

interface RenameOptions {
  oldName: string;
  newName: string;
  directory: vscode.Uri;
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

export const renameCommand = async (uri: vscode.Uri) => {
  if (!uri || !uri.fsPath) {
    vscode.window.showErrorMessage('Please right-click a component directory to rename it.');
    return;
  }

  const configResult = await findConfig(uri.fsPath);
  if (!configResult) {
    return;
  }
  const { config } = configResult;

  const currentName = path.basename(uri.fsPath);
  const newName = await vscode.window.showInputBox({
    prompt: 'New component name in PascalCase',
    placeHolder: 'e.g. NewComponentName',
    value: currentName,
    validateInput: (value) => validateComponentName(value, config.componentNamePattern),
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
};
