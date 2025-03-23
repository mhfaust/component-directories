import * as vscode from 'vscode';

jest.mock('vscode');
jest.mock('fs/promises');

beforeAll(() => {});

afterAll(() => {});

beforeEach(() => {
  jest.clearAllMocks();
  (vscode.window.showErrorMessage as jest.Mock)?.mockClear();
  (vscode.window.showWarningMessage as jest.Mock)?.mockClear();
  (vscode.window.showInformationMessage as jest.Mock)?.mockClear();
  (vscode.window.showQuickPick as jest.Mock)?.mockClear();
  (vscode.window.showInputBox as jest.Mock)?.mockClear();
  (vscode.window.createOutputChannel as jest.Mock)?.mockClear();
});
