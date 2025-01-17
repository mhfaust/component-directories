import * as vscode from 'vscode';
import * as path from 'path';
import { findConfig, validateComponentName } from '../configurationUtils';
import { generateFromTemplates } from '../generationUtils';

export const createWithDefaultFiles = async (uri: vscode.Uri) => {
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
    validateInput: (value) => validateComponentName(value, config.componentNamePattern),
  });

  if (!componentName) {
    return;
  }

  try {
    await generateFromTemplates(
      componentName,
      uri.fsPath,
      config.defaultTemplateGroup,
      templatesPath,
      config.replacements,
    );
    vscode.window.showInformationMessage(`Component ${componentName} created successfully!`);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error generating component: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
