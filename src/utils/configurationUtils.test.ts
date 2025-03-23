import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getComponentNamePrompt, validateComponentName, findConfig } from './configurationUtils';

jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    createOutputChannel: jest.fn().mockReturnValue({
      clear: jest.fn(),
      appendLine: jest.fn(),
      show: jest.fn(),
    }),
  },
  Uri: {
    file: jest.fn().mockImplementation((path) => ({ fsPath: path })),
  },
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  access: jest.fn(),
}));

describe('configurationUtils', () => {
  describe('getComponentNamePrompt', () => {
    it('should return the correct prompt message', () => {
      expect(getComponentNamePrompt()).toBe(
        'Component name (PascalCase, camelCase, kebab-case, or snake_case)',
      );
    });
  });

  describe('validateComponentName', () => {
    it('should return null for valid component names', () => {
      expect(validateComponentName('MyComponent')).toBeNull();
      expect(validateComponentName('myComponent')).toBeNull();
      expect(validateComponentName('my-component')).toBeNull();
      expect(validateComponentName('my_component')).toBeNull();
    });

    it('should return error message for invalid component names', () => {
      expect(validateComponentName('My-Component')).toBe(
        'Component name must be in a valid case format (PascalCase, camelCase, kebab-case, or snake_case)',
      );
      expect(validateComponentName('123')).toBe(
        'Component name must be in a valid case format (PascalCase, camelCase, kebab-case, or snake_case)',
      );
    });
  });

  describe('findConfig', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should find and validate a correct configuration file', async () => {
      const validConfig = {
        templatesDirectory: 'component-templates',
        directoryCase: 'pascal',
        templates: [
          {
            source: 'component.tsx.template',
            target: '{{PascalCaseComponentName}}.tsx',
            label: 'Component',
          },
          { source: 'index.ts.template', target: 'index.ts', label: 'Index' },
        ],
        defaultTemplateGroup: ['component.tsx.template', 'index.ts.template'],
      };

      const mockFilePath = '/path/to/project';
      const mockConfigPath = path.join(mockFilePath, '.component-templates.json');

      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(validConfig));
      (fs.access as jest.Mock).mockResolvedValue(undefined); // Files exist

      const result = await findConfig(mockFilePath);

      expect(result).toEqual({
        config: validConfig,
        configDir: mockFilePath,
      });

      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    });

    it('should search in parent directories if config is not found in current directory', async () => {
      const validConfig = {
        templatesDirectory: 'component-templates',
        templates: [
          {
            source: 'component.tsx.template',
            target: '{{PascalCaseComponentName}}.tsx',
            label: 'Component',
          },
        ],
        defaultTemplateGroup: ['component.tsx.template'],
      };

      const childPath = '/path/to/project/src/components';
      const parentPath = '/path/to/project';
      const mockConfigPath = path.join(parentPath, '.component-templates.json');

      (fs.readFile as jest.Mock)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(JSON.stringify(validConfig));

      (fs.access as jest.Mock).mockResolvedValue(undefined); // Files exist

      const result = await findConfig(childPath);

      expect(result).toEqual({
        config: validConfig,
        configDir: parentPath,
      });

      expect(fs.readFile).toHaveBeenNthCalledWith(3, mockConfigPath, 'utf-8');
    });

    it('should show error and return null when config validation fails', async () => {
      const invalidConfig = {
        templates: [],
        defaultTemplateGroup: [],
      };

      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(invalidConfig));

      const result = await findConfig('/path/to/project');

      expect(result).toBeNull();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should show error and return null for invalid JSON', async () => {
      (fs.readFile as jest.Mock).mockResolvedValueOnce('{ invalid json }');

      const result = await findConfig('/path/to/project');

      expect(result).toBeNull();
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should show error when no config is found in any parent directory', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await findConfig('/path/to/project');

      expect(result).toBeNull();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'No .component-templates.json found in this directory or any parent directories.',
      );
    });
  });
});
