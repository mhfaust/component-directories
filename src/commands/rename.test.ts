import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { renameCommand } from './rename';
import { findConfig, validateComponentName } from '../utils/configurationUtils';

jest.mock('../utils/configurationUtils');
jest.mock('fs/promises');

describe('renameCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (validateComponentName as jest.Mock).mockReturnValue(null);

    (fs.rename as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['Component.tsx', 'index.ts']);
    (fs.readFile as jest.Mock).mockResolvedValue('// Mock file content');
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
  });

  it('should show error when URI is not provided', async () => {
    await renameCommand(undefined as unknown as vscode.Uri);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Please right-click a component directory to rename it.',
    );
  });

  it('should exit when no configuration is found', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce(null);

    const mockUri = vscode.Uri.file('/path/to/components/MyComponent');
    await renameCommand(mockUri);

    expect(findConfig).toHaveBeenCalledWith('/path/to/components/MyComponent');
    expect(vscode.window.showInputBox).not.toHaveBeenCalled();
  });

  it('should prompt for new component name and perform rename', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const oldName = 'MyComponent';
    const newName = 'NewComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${oldName}`);

    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(newName);

    const mockWorkspaceEdit = new vscode.WorkspaceEdit();
    (vscode.commands.executeCommand as jest.Mock).mockResolvedValueOnce(mockWorkspaceEdit);

    (fs.readdir as jest.Mock)
      .mockResolvedValueOnce([`${oldName}.tsx`, 'index.ts']) // Directory read for renaming files
      .mockResolvedValueOnce([`${newName}.tsx`, 'index.ts']); // Directory read for updating content

    (fs.readFile as jest.Mock).mockResolvedValue(
      `import styles from './${oldName}.module.scss';

      type ${oldName}Props = {};
      
      const ${oldName} = ({}: ${oldName}Props) => {
        return <div className={styles.${oldName.toLowerCase()}}></div>;
      };
      
      export default ${oldName};`,
    );

    (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([]);

    await renameCommand(mockUri);

    expect(vscode.window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'New component name',
        value: oldName,
        validateInput: validateComponentName,
      }),
    );

    expect(fs.rename).toHaveBeenCalledWith(
      path.join('/path/to/components', oldName),
      path.join('/path/to/components', newName),
    );

    expect(fs.rename).toHaveBeenCalledWith(
      path.join('/path/to/components', newName, `${oldName}.tsx`),
      path.join('/path/to/components', newName, `${newName}.tsx`),
    );

    expect(fs.writeFile).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(newName + '.tsx'),
      expect.stringContaining(newName),
    );

    expect(fs.writeFile).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('index.ts'),
      expect.stringContaining(newName),
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      `Successfully renamed component from ${oldName} to ${newName}`,
    );
  });

  it('should do nothing when user inputs same component name', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const componentName = 'MyComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${componentName}`);

    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(componentName);

    await renameCommand(mockUri);

    expect(fs.rename).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('should exit when user cancels the input', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const mockUri = vscode.Uri.file('/path/to/components/MyComponent');

    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(null);

    await renameCommand(mockUri);

    expect(fs.rename).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('should update imports when renaming component', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const oldName = 'OldComponent';
    const newName = 'NewComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${oldName}`);

    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(newName);

    (fs.readdir as jest.Mock)
      .mockResolvedValueOnce([`${oldName}.tsx`, 'index.ts'])
      .mockResolvedValueOnce([`${newName}.tsx`, 'index.ts']);

    const mockImportFile = vscode.Uri.file('/path/to/components/App.tsx');
    (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([mockImportFile]);

    const mockDocument = {
      uri: mockImportFile,
      getText: jest.fn().mockReturnValue(`import ${oldName} from './components/${oldName}'`),
      positionAt: jest.fn().mockImplementation((index) => ({ line: 0, character: index })),
    };
    (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValueOnce(mockDocument);

    const mockEdit = new vscode.WorkspaceEdit();
    mockEdit.entries = jest.fn().mockReturnValue([
      [
        mockImportFile,
        [
          {
            range: {
              start: { line: 0, character: 7 },
              end: { line: 0, character: 7 + oldName.length },
            },
            newText: newName,
          },
        ],
      ],
    ]);
    (vscode.commands.executeCommand as jest.Mock).mockResolvedValueOnce(mockEdit);

    await renameCommand(mockUri);

    expect(vscode.workspace.findFiles).toHaveBeenCalledWith('**/*.{ts,tsx}', '**/node_modules/**');

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.executeDocumentRenameProvider',
      expect.any(Object),
      expect.any(Object),
      newName,
    );

    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
  });

  it('should handle errors during rename', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const oldName = 'OldComponent';
    const newName = 'NewComponent';
    const mockUri = vscode.Uri.file(`/path/to/components/${oldName}`);

    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(newName);

    const errorMessage = 'Failed to rename component';
    (fs.rename as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    await renameCommand(mockUri);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      `Error renaming component: ${errorMessage}`,
    );
  });

  it('should validate the new component name', async () => {
    (findConfig as jest.Mock).mockResolvedValueOnce({
      config: {},
      configDir: '/path/to/project',
    });

    const oldName = 'OldComponent';
    const invalidName = 'Invalid-Component';
    const mockUri = vscode.Uri.file(`/path/to/components/${oldName}`);

    const validationError = 'Component name must be in a valid case format';
    (validateComponentName as jest.Mock).mockReturnValueOnce(validationError);

    (vscode.window.showInputBox as jest.Mock).mockImplementationOnce(({ validateInput }) => {
      const result = validateInput(invalidName);
      return Promise.resolve(result ? null : invalidName); // Cancel if validation fails
    });

    await renameCommand(mockUri);

    expect(fs.rename).not.toHaveBeenCalled();
  });
});
