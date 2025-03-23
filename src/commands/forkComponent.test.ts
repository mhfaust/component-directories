import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { forkComponentCommand } from './forkComponent';
import {
  findConfig,
  getComponentNamePrompt,
  validateComponentName,
} from '../utils/configurationUtils';

// Mock the configurationUtils module
jest.mock('../utils/configurationUtils');
jest.mock('fs/promises');

describe('forkComponentCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for getComponentNamePrompt
    (getComponentNamePrompt as jest.Mock).mockReturnValue('Enter component name');

    // Default mock for validateComponentName to pass validation
    (validateComponentName as jest.Mock).mockReturnValue(null);

    // Default successful fs operations
    (fs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' }); // Target doesn't exist (good)
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['Component.tsx', 'index.ts']);
    (fs.readFile as jest.Mock).mockResolvedValue('// Mock file content');
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => false });
  });

  it('should show error when URI is not provided', async () => {
    await forkComponentCommand(undefined as unknown as vscode.Uri);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Please right-click a component directory to fork it.',
    );
  });

  it('should exit when no configuration is found', async () => {
    // Mock findConfig to return null (no config found)
    (findConfig as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/components/MyComponent');
    await forkComponentCommand(mockUri);

    expect(findConfig).toHaveBeenCalledWith('/path/to/components/MyComponent');
    expect(vscode.window.showInputBox).not.toHaveBeenCalled();
  });

  it('should prompt for new component name and perform fork', async () => {
    // Mock configuration
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    // Extract component name from path
    const sourceName = 'SourceComponent';
    const targetName = 'TargetComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${sourceName}`);

    // Mock input box to return a new component name
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(targetName);

    // Mock file operations
    (fs.readdir as jest.Mock).mockResolvedValueOnce([`${sourceName}.tsx`, 'index.ts']);

    (fs.readFile as jest.Mock).mockResolvedValue(
      `import styles from './${sourceName}.module.scss';

      type ${sourceName}Props = {};
      
      const ${sourceName} = ({}: ${sourceName}Props) => {
        return <div className={styles.${sourceName.toLowerCase()}}></div>;
      };
      
      export default ${sourceName};`,
    );

    await forkComponentCommand(mockUri);

    expect(fs.access).toHaveBeenCalledWith(expect.stringContaining(targetName));

    // Verify the input box was shown with correct options
    expect(vscode.window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(`Fork '${sourceName}' as...`),
        validateInput: validateComponentName,
      }),
    );

    // Verify directory was created
    expect(fs.mkdir).toHaveBeenCalledWith(
      path.join('/path/to/components', targetName),
      expect.anything(),
    );

    // // Verify files were written with updated content
    // expect(fs.writeFile).toHaveBeenCalled();

    // // Verify success message was shown
    // expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
    //   `Successfully forked component '${sourceName}' to '${targetName}'`,
    // );
  });

  it('should exit when user cancels component name input', async () => {
    // Mock configuration found
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    // Mock input box to return null (user cancelled)
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/components/SourceComponent');
    await forkComponentCommand(mockUri);

    // Verify no file operations were performed
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should show error when target component already exists', async () => {
    // Mock configuration
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const sourceName = 'SourceComponent';
    const targetName = 'ExistingComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${sourceName}`);

    // Mock input box to return a target component name
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(targetName);

    // Mock target component already exists
    (fs.access as jest.Mock).mockResolvedValueOnce(undefined);

    await forkComponentCommand(mockUri);

    // Verify error message was shown
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining(`Component '${targetName}' already exists`),
    );

    // Verify no file operations were performed
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should show error when source and target names are the same', async () => {
    // Mock configuration
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const componentName = 'MyComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${componentName}`);

    // Mock input box to return the same component name
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(componentName);

    await forkComponentCommand(mockUri);

    // Verify error message was shown
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'New component name must be different from the original name.',
    );

    // Verify no file operations were performed
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should handle subdirectories in components', async () => {
    // Mock configuration
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const sourceName = 'SourceComponent';
    const targetName = 'TargetComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${sourceName}`);

    // Mock input box to return a new component name
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(targetName);

    // Mock subdirectory in component
    (fs.readdir as jest.Mock).mockResolvedValueOnce([`${sourceName}.tsx`, 'utils']);
    (fs.stat as jest.Mock)
      .mockResolvedValueOnce({ isDirectory: () => false }) // For ComponentName.tsx
      .mockResolvedValueOnce({ isDirectory: () => true }); // For utils directory

    // Mock utils subdirectory contents
    (fs.readdir as jest.Mock)
      .mockResolvedValueOnce([`${sourceName}.tsx`, 'utils'])
      .mockResolvedValueOnce(['helpers.ts']);

    await forkComponentCommand(mockUri);

    // Verify subdirectory was created
    expect(fs.mkdir).toHaveBeenCalledWith(
      path.join('/path/to/components', targetName, 'utils'),
      expect.anything(),
    );

    // Verify success message was shown
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      `Successfully forked component '${sourceName}' to '${targetName}'`,
    );
  });

  it('should handle errors during fork operation', async () => {
    // Mock configuration
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const sourceName = 'SourceComponent';
    const targetName = 'TargetComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${sourceName}`);

    // Mock input box to return a new component name
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(targetName);

    // Mock error during mkdir
    const errorMessage = 'Failed to create directory';
    (fs.mkdir as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    await forkComponentCommand(mockUri);

    // Verify error message was shown
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      `Error forking component: ${errorMessage}`,
    );
  });
});
