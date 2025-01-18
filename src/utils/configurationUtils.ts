import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export type TemplateItem = {
  source: string;
  target: string;
  label: string;
};

export type TemplateGroup = {
  label: string;
  templates: string[];
};

type TemplateConfig = {
  templatesDir: string;
  componentNamePattern: string;
  templates: TemplateItem[];
  defaultTemplateGroup: string[];
  alternateTemplateGroups?: TemplateGroup[];
};

export function validateComponentName(name: string, pattern: string): string | null {
  if (!new RegExp(pattern).test(name)) {
    return `Component name must match pattern: ${pattern}`;
  }
  return null;
}

function validateConfig(config: any): config is TemplateConfig {
  if (!config.templatesDir || typeof config.templatesDir !== 'string') {
    throw new Error('Missing or invalid templatesDir configuration');
  }

  if (config.templatesDir.includes('/') || config.templatesDir.includes('\\')) {
    throw new Error(
      'templatesDir must be a directory name without any path segments (e.g. "component-templates" not "./templates" or "path/to/templates")',
    );
  }

  if (!config.componentNamePattern || typeof config.componentNamePattern !== 'string') {
    throw new Error('Missing or invalid componentNamePattern configuration');
  }

  try {
    new RegExp(config.componentNamePattern);
  } catch (e) {
    throw new Error('Invalid componentNamePattern regex: ' + (e as Error).message);
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
