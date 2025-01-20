import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CaseType, isValidCase } from './caseUtils';

export type TemplateItem = {
  source: string;
  target: string;
  label: string;
};

export type TemplateGroup = {
  label: string;
  templates: string[];
};

export type TemplateConfig = {
  templatesDirectory: string;
  directoryCase?: CaseType;
  templates: TemplateItem[];
  defaultTemplateGroup: string[];
  alternateTemplateGroups?: TemplateGroup[];
};

export function getComponentNamePrompt(): string {
  return 'Component name (PascalCase, camelCase, kebab-case, or snake_case)';
}

export function validateComponentName(name: string): string | null {
  if (!isValidCase(name)) {
    return 'Component name must be in a valid case format (PascalCase, camelCase, kebab-case, or snake_case)';
  }
  return null;
}

function validateConfig(config: any): config is TemplateConfig {
  if (!config.templatesDirectory || typeof config.templatesDirectory !== 'string') {
    throw new Error('Missing or invalid templatesDirectory configuration');
  }

  if (config.templatesDirectory.includes('/') || config.templatesDirectory.includes('\\')) {
    throw new Error(
      'templatesDirectory must be a directory name without any path segments (e.g. "component-templates" not "./templates" or "path/to/templates")',
    );
  }

  if (config.directoryCase !== undefined) {
    const validCases: CaseType[] = ['pascal', 'camel', 'kebab', 'snake'];
    if (!validCases.includes(config.directoryCase)) {
      throw new Error('directoryCase must be one of: "pascal", "camel", "kebab", or "snake"');
    }
  }

  if (!Array.isArray(config.templates)) {
    throw new Error('Missing or invalid templates array configuration');
  }

  if (!Array.isArray(config.defaultTemplateGroup)) {
    throw new Error('Missing or invalid defaultTemplateGroup configuration');
  }

  // Validate that all templates referenced in groups exist in the templates array
  const templateSources = new Set(config.templates?.map((t: TemplateItem) => t.source));

  // Check defaultTemplateGroup references
  for (const source of config.defaultTemplateGroup) {
    if (!templateSources.has(source)) {
      throw new Error(
        `Template "${source}" referenced in defaultTemplateGroup not found in templates array`,
      );
    }
  }

  // Check alternateTemplateGroups references
  if (config.alternateTemplateGroups) {
    for (const group of config.alternateTemplateGroups) {
      if (!group.label || typeof group.label !== 'string') {
        throw new Error('Invalid or missing label in alternateTemplateGroup');
      }
      if (!Array.isArray(group.templates)) {
        throw new Error(`Invalid templates array in alternateTemplateGroup "${group.label}"`);
      }
      for (const source of group.templates) {
        if (!templateSources.has(source)) {
          throw new Error(
            `Template "${source}" referenced in group "${group.label}" not found in templates array`,
          );
        }
      }
    }
  }

  return true;
}

async function validateTemplates(config: TemplateConfig, templatesPath: string): Promise<string[]> {
  const errors: string[] = [];

  // Validate all template files exist
  for (const template of config.templates) {
    try {
      await fs.access(path.join(templatesPath, template.source));
    } catch {
      errors.push(`Template file not found: ${template.source}`);
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
    const templateErrors = await validateTemplates(
      config,
      path.join(path.dirname(configPath), config.templatesDirectory),
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

export async function findConfig(
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

      const validationResult = await validateFullConfig(parsedConfig, configPath);

      if (!validationResult.isValid) {
        const showDetails = 'Show Details';
        const selected = await vscode.window.showErrorMessage(
          'Configuration validation failed. Click "Show Details" for more information.',
          showDetails,
        );

        if (selected === showDetails) {
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

      return {
        config: parsedConfig as TemplateConfig,
        configDir: currentPath,
      };
    } catch (error) {
      currentPath = path.dirname(currentPath);
    }
  }

  vscode.window.showErrorMessage(
    'No .component-templates.json found in this directory or any parent directories.',
  );
  return null;
}
