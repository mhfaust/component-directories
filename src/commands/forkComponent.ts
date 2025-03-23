import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  findConfig,
  validateComponentName,
  getComponentNamePrompt,
} from '../utils/configurationUtils';
import { transform, CaseType } from '../utils/caseUtils';

interface ForkOptions {
  sourceName: string;
  targetName: string;
  directory: vscode.Uri;
}

async function copyDirectory(
  sourcePath: string,
  targetPath: string,
  sourceName: string,
  targetName: string,
) {
  await fs.mkdir(targetPath, { recursive: true });

  const files = await fs.readdir(sourcePath);

  for (const file of files) {
    const sourceFilePath = path.join(sourcePath, file);
    const stats = await fs.stat(sourceFilePath);

    const targetFileName = file.replace(sourceName, targetName);
    const targetFilePath = path.join(targetPath, targetFileName);

    if (stats.isDirectory()) {
      await copyDirectory(sourceFilePath, targetFilePath, sourceName, targetName);
    } else {
      const content = await fs.readFile(sourceFilePath, 'utf-8');

      const processedContent = (['pascal', 'camel', 'kebab', 'snake'] as CaseType[]).reduce(
        (acc, caseType) => {
          const sourceVariant = transform(sourceName, caseType);
          const targetVariant = transform(targetName, caseType);

          if (sourceVariant && targetVariant) {
            return acc.replaceAll(sourceVariant, targetVariant);
          }
          return acc;
        },
        content,
      );

      await fs.writeFile(targetFilePath, processedContent);
    }
  }
}

async function forkComponent({ sourceName, targetName, directory }: ForkOptions) {
  const sourcePath = path.join(directory.fsPath, sourceName);
  const targetPath = path.join(directory.fsPath, targetName);

  try {
    await fs.access(targetPath);
    throw new Error(`Component '${targetName}' already exists`);
  } catch (error) {
    if (!error || (error as { code: string }).code !== 'ENOENT') {
      throw error;
    }
  }

  await copyDirectory(sourcePath, targetPath, sourceName, targetName);
}

export const forkComponentCommand = async (uri: vscode.Uri) => {
  if (!uri || !uri.fsPath) {
    vscode.window.showErrorMessage('Please right-click a component directory to fork it.');
    return;
  }

  const configResult = await findConfig(uri.fsPath);
  if (!configResult) {
    return;
  }

  const sourceName = path.basename(uri.fsPath);
  const targetName = await vscode.window.showInputBox({
    prompt: `Fork '${sourceName}' as... ${getComponentNamePrompt()}`,
    placeHolder: 'e.g., MyComponent, myComponent, my-component, or my_component',
    validateInput: validateComponentName,
  });

  if (!targetName) {
    return;
  }

  if (targetName === sourceName) {
    vscode.window.showErrorMessage('New component name must be different from the original name.');
    return;
  }

  try {
    await forkComponent({
      sourceName,
      targetName,
      directory: vscode.Uri.file(path.dirname(uri.fsPath)),
    });

    vscode.window.showInformationMessage(
      `Successfully forked component '${sourceName}' to '${targetName}'`,
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error forking component: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
