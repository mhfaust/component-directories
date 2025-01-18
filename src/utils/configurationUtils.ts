import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

type TemplateConfig = {
  templatesDir: string;
  componentNamePattern: string;
  defaultTemplateGroup: TemplateItem[];
  alternateTemplateGroups?: TemplateGroup[];
};

export type TemplateItem = {
  source: string;
  target: string;
  label: string;
};

type TemplateGroup = {
  label: string;
  templates: TemplateItem[];
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

  if (!Array.isArray(config.defaultTemplateGroup)) {
    throw new Error('Missing or invalid defaultTemplateGroup configuration');
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

  for (const template of config.defaultTemplateGroup) {
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
