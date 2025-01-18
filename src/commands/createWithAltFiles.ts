import * as vscode from 'vscode';
import * as path from 'path';
import { findConfig, validateComponentName } from '../utils/configurationUtils';
import { generateFromTemplates } from '../utils/generationUtils';

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

  const quickPickItems = config.alternateTemplateGroups.map((group) => ({
    label: group.label,
    description: `${group.templates.length} file${group.templates.length === 1 ? '' : 's'}`,
    templateGroup: group,
  }));

  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: 'Select component type...',
    title: 'Create Component',
  });

  if (!selectedItem) {
    return;
  }

  const componentName = await vscode.window.showInputBox({
    prompt: 'Component name in PascalCase',
    placeHolder: 'e.g. MyComponent',
    validateInput: (value) => validateComponentName(value, config.componentNamePattern),
  });

  if (!componentName) {
    return;
  }

  const templatesPath = path.join(configDir, config.templatesDir);

  try {
    await generateFromTemplates(
      componentName,
      uri.fsPath,
      selectedItem.templateGroup.templates,
      config.templates,
      templatesPath,
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
