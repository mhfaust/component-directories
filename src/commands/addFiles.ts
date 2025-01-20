import * as vscode from 'vscode';
import * as path from 'path';
import { findConfig, TemplateItem, validateComponentName } from '../utils/configurationUtils';
import { generateFromTemplates } from '../utils/generationUtils';

interface QuickPickTemplateItem extends vscode.QuickPickItem {
  templateSource: string;
}

export async function addFiles(uri: vscode.Uri) {
  if (!uri || !uri.fsPath) {
    vscode.window.showErrorMessage('Please right-click a directory to add component files.');
    return;
  }

  const configResult = await findConfig(uri.fsPath);
  if (!configResult) {
    return;
  }

  const { config, configDir } = configResult;

  const componentName = path.basename(uri.fsPath);
  const validationError = validateComponentName(componentName);
  if (validationError) {
    vscode.window.showErrorMessage(
      `Invalid component directory name: ${componentName}. ${validationError}`,
    );
    return;
  }

  const quickPickItems: (QuickPickTemplateItem | vscode.QuickPickItem)[] = [];

  // Function to find template details by source
  const getTemplateDetails = (source: string): TemplateItem | undefined =>
    config.templates.find((t) => t.source === source);

  // Add default templates section
  if (config.defaultTemplateGroup.length > 0) {
    quickPickItems.push({
      label: 'Default Template Group Files',
      kind: vscode.QuickPickItemKind.Separator,
    });

    quickPickItems.push(
      ...config.defaultTemplateGroup.map((source) => {
        const template = getTemplateDetails(source);
        if (!template) {
          throw new Error(`Template not found: ${source}`);
        }
        return {
          label: template.label,
          templateSource: source,
          // We'll let the generation utils handle the case transformations
          description:
            template.target.includes('{{') ? `(Will match component name case)` : template.target,
        };
      }),
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
        ...group.templates.map((source) => {
          const template = getTemplateDetails(source);
          if (!template) {
            throw new Error(`Template not found: ${source}`);
          }
          return {
            label: template.label,
            templateSource: source,
            description:
              template.target.includes('{{') ? `(Will match component name case)` : template.target,
          };
        }),
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

  // Filter out any separator items and get just the template sources
  const selectedTemplateSources = selectedItems
    .filter(
      (item): item is QuickPickTemplateItem =>
        !('kind' in item) || item.kind !== vscode.QuickPickItemKind.Separator,
    )
    .map((item) => item.templateSource);

  const templatesPath = path.join(configDir, config.templatesDirectory);

  try {
    const result = await generateFromTemplates(
      componentName,
      path.dirname(uri.fsPath),
      selectedTemplateSources,
      config.templates,
      templatesPath,
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
