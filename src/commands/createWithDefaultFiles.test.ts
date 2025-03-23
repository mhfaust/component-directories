import * as vscode from 'vscode';
import * as path from 'path';
import { createWithDefaultFiles } from './createWithDefaultFiles';
import {
  findConfig,
  getComponentNamePrompt,
  validateComponentName,
} from '../utils/configurationUtils';
import { generateFromTemplates } from '../utils/generationUtils';

// Mock the utility modules
jest.mock('../utils/configurationUtils');
jest.mock('../utils/generationUtils');

describe('createWithDefaultFiles command', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for getComponentNamePrompt
    (getComponentNamePrompt as jest.Mock).mockReturnValue('Enter component name');

    // Default mock for validateComponentName to pass validation
    (validateComponentName as jest.Mock).mockReturnValue(null);
  });

  it('should show error when URI is not provided', async () => {
    await createWithDefaultFiles(undefined as unknown as vscode.Uri);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Please right-click a directory to generate the component.',
    );
  });

  it('should exit when no configuration is found', async () => {
    // Mock findConfig to return null (no config found)
    (findConfig as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/components');
    await createWithDefaultFiles(mockUri);

    expect(findConfig).toHaveBeenCalledWith('/path/to/components');
    expect(vscode.window.showInputBox).not.toHaveBeenCalled();
  });

  it('should prompt for component name and create files', async () => {
    // Mock configuration
    const mockConfig = {
      config: {
        defaultTemplateGroup: ['component.tsx.template', 'index.ts.template'],
        templates: [
          {
            source: 'component.tsx.template',
            label: 'Component',
            target: '{{PascalCaseComponentName}}.tsx',
          },
          { source: 'index.ts.template', label: 'Index', target: 'index.ts' },
        ],
        templatesDirectory: 'component-templates',
      },
      configDir: '/path/to/project',
    };

    (findConfig as jest.Mock).mockResolvedValueOnce(mockConfig);

    // Mock input box to return a component name
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('MyComponent');

    // Mock successful file generation
    (generateFromTemplates as jest.Mock).mockResolvedValueOnce({
      success: true,
      addedFiles: ['MyComponent.tsx', 'index.ts'],
      existingFiles: [],
    });

    const mockUri = vscode.Uri.file('/path/to/components');
    await createWithDefaultFiles(mockUri);

    // Verify the input box was shown with correct options
    expect(vscode.window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Enter component name',
        validateInput: validateComponentName,
      }),
    );

    // Verify generateFromTemplates was called with correct arguments
    expect(generateFromTemplates).toHaveBeenCalledWith(
      'MyComponent',
      '/path/to/components',
      mockConfig.config.defaultTemplateGroup,
      mockConfig.config.templates,
      path.join('/path/to/project', 'component-templates'),
    );

    // Verify success message was shown
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Component MyComponent created successfully!',
    );
  });

  it('should exit when user cancels component name input', async () => {
    const mockConfig = {
      config: {
        defaultTemplateGroup: ['component.tsx.template', 'index.ts.template'],
        templates: [
          {
            source: 'component.tsx.template',
            label: 'Component',
            target: '{{PascalCaseComponentName}}.tsx',
          },
          { source: 'index.ts.template', label: 'Index', target: 'index.ts' },
        ],
        templatesDirectory: 'component-templates',
      },
      configDir: '/path/to/project',
    };
    // Mock configuration found
    (findConfig as jest.Mock).mockResolvedValueOnce(mockConfig);

    // Mock input box to return null (user cancelled)
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/components');
    await createWithDefaultFiles(mockUri);

    // Verify generate was not called
    expect(generateFromTemplates).not.toHaveBeenCalled();
  });

  it('should handle errors during generation', async () => {
    // Mock configuration
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {
        defaultTemplateGroup: ['component.tsx.template'],
        templates: [
          {
            source: 'component.tsx.template',
            label: 'Component',
            target: '{{PascalCaseComponentName}}.tsx',
          },
        ],
        templatesDirectory: 'templates',
      },
      configDir: '/path/to/project',
    });

    // Mock input box to return a component name
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('MyComponent');

    // Mock generation error
    const errorMessage = 'Failed to generate component';
    (generateFromTemplates as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const mockUri = vscode.Uri.file('/path/to/components');
    await createWithDefaultFiles(mockUri);

    // Verify error message was shown
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      `Error generating component: ${errorMessage}`,
    );
  });
});
