import * as vscode from 'vscode';
import * as path from 'path';
import { addFiles } from './addFiles';
import { findConfig } from '../utils/configurationUtils';
import { generateFromTemplates } from '../utils/generationUtils';

// Mock the configurationUtils and generationUtils modules
jest.mock('../utils/configurationUtils');
jest.mock('../utils/generationUtils');

describe('addFiles command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // (vscode as any).__resetMocks();
  });

  it('should show error when URI is not provided', async () => {
    await addFiles(undefined as unknown as vscode.Uri);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Please right-click a directory to add component files.',
    );
  });

  it('should exit when no configuration is found', async () => {
    // Mock findConfig to return null (no config found)
    (findConfig as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/component');
    await addFiles(mockUri);

    expect(findConfig).toHaveBeenCalledWith('/path/to/component');
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
  });

  it('should show QuickPick with templates from configuration', async () => {
    // Mock configuration with templates
    const mockConfig = {
      config: {
        defaultTemplateGroup: ['component.tsx.template', 'index.ts.template'],
        alternateTemplateGroups: [
          {
            label: 'Test Group',
            templates: ['test.tsx.template'],
          },
        ],
        templates: [
          {
            source: 'component.tsx.template',
            label: 'Component',
            target: '{{PascalCaseComponentName}}.tsx',
          },
          { source: 'index.ts.template', label: 'Index', target: 'index.ts' },
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

    // Mock URI with valid component name
    const mockUri = vscode.Uri.file('/path/to/MyComponent');

    // Set up QuickPick to return a selection
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce([
      { label: 'Test', templateSource: 'test.tsx.template' },
    ]);

    // Mock successful file generation
    (generateFromTemplates as jest.Mock).mockResolvedValueOnce({
      success: true,
      addedFiles: ['MyComponent.test.tsx'],
      existingFiles: [],
    });

    await addFiles(mockUri);

    expect(vscode.window.showQuickPick).toHaveBeenCalled();

    const quickPickItems = (vscode.window.showQuickPick as jest.Mock).mock.calls[0][0];

    expect(quickPickItems).toContainEqual(
      expect.objectContaining({
        label: 'Default Template Group Files',
        kind: vscode.QuickPickItemKind.Separator,
      }),
    );
    expect(quickPickItems).toContainEqual(
      expect.objectContaining({ label: 'Component', templateSource: 'component.tsx.template' }),
    );
    expect(quickPickItems).toContainEqual(
      expect.objectContaining({ label: 'Index', templateSource: 'index.ts.template' }),
    );
    expect(quickPickItems).toContainEqual(
      expect.objectContaining({ label: 'Test Group', kind: vscode.QuickPickItemKind.Separator }),
    );
    expect(quickPickItems).toContainEqual(
      expect.objectContaining({ label: 'Test', templateSource: 'test.tsx.template' }),
    );

    // Check that generateFromTemplates was called with the right arguments
    expect(generateFromTemplates).toHaveBeenCalledWith(
      'MyComponent',
      '/path/to',
      ['test.tsx.template'],
      mockConfig.config.templates,
      path.join('/path/to/project', 'component-templates'), // Now includes templatesDirectory
    );

    // Check success message was shown
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Successfully added 1 file(s)'),
    );
  });

  it('should show warning when some files already exist', async () => {
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
        templatesDirectory: 'component-templates',
      },
      configDir: '/path/to/project',
    });

    const mockUri = vscode.Uri.file('/path/to/MyComponent');

    // QuickPick returns a selection
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce([
      { label: 'Component', templateSource: 'component.tsx.template' },
    ]);

    // Generate returns mixed results
    (generateFromTemplates as jest.Mock).mockResolvedValueOnce({
      success: true,
      addedFiles: ['styles.scss'],
      existingFiles: ['MyComponent.tsx'],
    });

    await addFiles(mockUri);

    // Check warning about existing files
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('skipped 1 existing file(s)'),
    );
  });

  it('should handle the case when no templates are found', async () => {
    // Mock empty configuration
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {
        defaultTemplateGroup: [],
        templates: [],
        templatesDirectory: 'component-templates',
      },
      configDir: '/path/to/project',
    });

    const mockUri = vscode.Uri.file('/path/to/MyComponent');

    await addFiles(mockUri);

    // Check error about no templates
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'No templates found in configuration.',
    );
  });

  it('should do nothing when user cancels QuickPick', async () => {
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
        templatesDirectory: 'component-templates',
      },
      configDir: '/path/to/project',
    });

    const mockUri = vscode.Uri.file('/path/to/MyComponent');

    // QuickPick returns null (user cancelled)
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(null);

    await addFiles(mockUri);

    // Verify generateFromTemplates was not called
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
        templatesDirectory: 'component-templates',
      },
      configDir: '/path/to/project',
    });

    const mockUri = vscode.Uri.file('/path/to/MyComponent');

    // QuickPick returns a selection
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce([
      { label: 'Component', templateSource: 'component.tsx.template' },
    ]);

    // Generate throws an error
    const errorMessage = 'Test error during generation';
    (generateFromTemplates as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    await addFiles(mockUri);

    // Check error handling
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining(`Error adding files: ${errorMessage}`),
    );
  });
});
