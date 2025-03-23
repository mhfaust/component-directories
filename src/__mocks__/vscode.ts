// Mock implementation of the vscode module
const vscode = {
  window: {
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    createOutputChannel: jest.fn().mockReturnValue({
      clear: jest.fn(),
      appendLine: jest.fn(),
      show: jest.fn(),
    }),
    showQuickPick: jest.fn().mockResolvedValue(null),
    showInputBox: jest.fn().mockResolvedValue(''),
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn().mockResolvedValue({}),
  },
  workspace: {
    getConfiguration: jest.fn(),
    findFiles: jest.fn().mockResolvedValue([]),
    applyEdit: jest.fn().mockResolvedValue(true),
    openTextDocument: jest.fn().mockImplementation((uri) => ({
      uri,
      getText: jest.fn().mockReturnValue(''),
      positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
    })),
  },
  Uri: {
    file: jest.fn().mockImplementation((path) => ({ fsPath: path })),
    parse: jest.fn().mockImplementation((uri) => ({ fsPath: uri })),
  },
  Range: jest.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  })),
  Position: jest.fn().mockImplementation((line, character) => ({
    line,
    character,
  })),
  WorkspaceEdit: jest.fn().mockImplementation(() => ({
    replace: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    entries: jest.fn().mockReturnValue([]),
  })),
  QuickPickItemKind: {
    Separator: 1,
    Default: 0,
  },
  extensions: {
    getExtension: jest.fn(),
  },
  ExtensionContext: jest.fn().mockImplementation(() => ({
    subscriptions: [],
  })),
};

export = vscode;
