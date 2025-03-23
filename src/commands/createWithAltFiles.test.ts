import * as vscode from 'vscode';
import * as path from 'path';
import { createAltComponent } from './createWithAltFiles';
import {
  findConfig,
  getComponentNamePrompt,
  validateComponentName,
} from '../utils/configurationUtils';
import { generateFromTemplates } from '../utils/generationUtils';

jest.mock('../utils/configurationUtils');
jest.mock('../utils/generationUtils');

describe('createAltComponent command', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getComponentNamePrompt as jest.Mock).mockReturnValue('Enter component name');

    (validateComponentName as jest.Mock).mockReturnValue(null);
  });

  it('should show error when URI is not provided', async () => {
    await createAltComponent(undefined as unknown as vscode.Uri);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Please right-click a directory to generate the component.',
    );
  });

  it('should exit when no configuration is found', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/components');
    await createAltComponent(mockUri);

    expect(findConfig).toHaveBeenCalledWith('/path/to/components');
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
  });

  it('should show error when no alternate template groups are defined', async () => {
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
      },
      configDir: '/path/to/project',
    });

    const mockUri = vscode.Uri.file('/path/to/components');
    await createAltComponent(mockUri);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'No alternate template groups defined in configuration.',
    );
  });

  it('should show template group selection and create component', async () => {
    const mockConfig = {
      config: {
        alternateTemplateGroups: [
          {
            label: 'Simple Component',
            templates: ['component-simple.tsx.template', 'index.ts.template'],
          },
          {
            label: 'Full Component',
            templates: ['component.tsx.template', 'styles.scss.template', 'test.tsx.template'],
          },
        ],
        templates: [
          {
            source: 'component.tsx.template',
            label: 'Component',
            target: '{{PascalCaseComponentName}}.tsx',
          },
          {
            source: 'component-simple.tsx.template',
            label: 'Simple',
            target: '{{PascalCaseComponentName}}.tsx',
          },
          { source: 'index.ts.template', label: 'Index', target: 'index.ts' },
          {
            source: 'styles.scss.template',
            label: 'Styles',
            target: '{{PascalCaseComponentName}}.module.scss',
          },
          {
            source: 'test.tsx.template',
            label: 'Test',
            target: '{{PascalCaseComponentName}}.test.tsx',
          },
        ],
        templatesDirectory: 'component-templates',
      },
      configDir: '/path/to/project',
    };

    (findConfig as jest.Mock).mockResolvedValueOnce(mockConfig);

    (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
      label: 'Simple Component',
      templateGroup: mockConfig.config.alternateTemplateGroups[0],
    });

    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('MyComponent');

    (generateFromTemplates as jest.Mock).mockResolvedValueOnce({
      success: true,
      addedFiles: ['MyComponent.tsx', 'index.ts'],
      existingFiles: [],
    });

    const mockUri = vscode.Uri.file('/path/to/components');
    await createAltComponent(mockUri);

    expect(vscode.window.showQuickPick).toHaveBeenCalled();
    const quickPickItems = (vscode.window.showQuickPick as jest.Mock).mock.calls[0][0];
    expect(quickPickItems).toEqual([
      {
        label: 'Simple Component',
        description: '2 files',
        templateGroup: mockConfig.config.alternateTemplateGroups[0],
      },
      {
        label: 'Full Component',
        description: '3 files',
        templateGroup: mockConfig.config.alternateTemplateGroups[1],
      },
    ]);

    expect(vscode.window.showInputBox).toHaveBeenCalled();

    expect(generateFromTemplates).toHaveBeenCalledWith(
      'MyComponent',
      '/path/to/components',
      ['component-simple.tsx.template', 'index.ts.template'],
      mockConfig.config.templates,
      path.join('/path/to/project', 'component-templates'),
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Component MyComponent created successfully using Simple Component template!',
    );
  });

  it('should exit when user cancels template group selection', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {
        alternateTemplateGroups: [
          {
            label: 'Simple Component',
            templates: ['component-simple.tsx.template'],
          },
        ],
        templates: [],
      },
      configDir: '/path/to/project',
    });

    (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/components');
    await createAltComponent(mockUri);

    expect(vscode.window.showInputBox).not.toHaveBeenCalled();
    expect(generateFromTemplates).not.toHaveBeenCalled();
  });

  it('should exit when user cancels component name input', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {
        alternateTemplateGroups: [
          {
            label: 'Simple Component',
            templates: ['component-simple.tsx.template'],
          },
        ],
        templates: [],
      },
      configDir: '/path/to/project',
    });

    (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
      label: 'Simple Component',
      templateGroup: { templates: ['component-simple.tsx.template'] },
    });

    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/components');
    await createAltComponent(mockUri);

    expect(generateFromTemplates).not.toHaveBeenCalled();
  });

  it('should handle errors during generation', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {
        alternateTemplateGroups: [
          {
            label: 'Simple Component',
            templates: ['component-simple.tsx.template'],
          },
        ],
        templates: [
          {
            source: 'component-simple.tsx.template',
            label: 'Simple',
            target: '{{PascalCaseComponentName}}.tsx',
          },
        ],
        templatesDirectory: 'templates',
      },
      configDir: '/path/to/project',
    });

    (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
      label: 'Simple Component',
      templateGroup: { templates: ['component-simple.tsx.template'] },
    });

    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('MyComponent');

    const errorMessage = 'Failed to generate component';
    (generateFromTemplates as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const mockUri = vscode.Uri.file('/path/to/components');
    await createAltComponent(mockUri);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      `Error generating component: ${errorMessage}`,
    );
  });
});
