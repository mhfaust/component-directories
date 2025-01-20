import * as vscode from 'vscode';
import * as path from 'path';
import {
  findConfig,
  getComponentNamePrompt,
  validateComponentName,
} from '../utils/configurationUtils';
import { generateFromTemplates } from '../utils/generationUtils';

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
  const templatesPath = path.join(configDir, config.templatesDirectory);

  const componentName = await vscode.window.showInputBox({
    prompt: getComponentNamePrompt(),
    placeHolder: 'e.g., MyComponent, myComponent, my-component, or my_component',
    validateInput: validateComponentName,
  });

  if (!componentName) {
    return;
  }

  try {
    await generateFromTemplates(
      componentName,
      uri.fsPath,
      config.defaultTemplateGroup,
      config.templates,
      templatesPath,
    );
    vscode.window.showInformationMessage(`Component ${componentName} created successfully!`);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error generating component: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
