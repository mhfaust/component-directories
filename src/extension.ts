import * as vscode from 'vscode';
import { createAltComponent } from './generationUtils';
import { renameCommand } from './commands/rename';
import { createWithDefaultFiles } from './commands/createWithDefaultFiles';
import { addFiles } from './commands/addFiles';

export function activate(context: vscode.ExtensionContext) {
  let createAltComponentDisposable = vscode.commands.registerCommand(
    'extension.createAltComponent',
    createAltComponent,
  );

  let addFilesDisposable = vscode.commands.registerCommand('extension.addComponentFiles', addFiles);

  let createDefaultDisposable = vscode.commands.registerCommand(
    'extension.createDefault',
    createWithDefaultFiles,
  );

  let renameDisposable = vscode.commands.registerCommand(
    'extension.renameComponent',
    renameCommand,
  );

  context.subscriptions.push(createDefaultDisposable);
  context.subscriptions.push(renameDisposable);
  context.subscriptions.push(createAltComponentDisposable);
  context.subscriptions.push(addFilesDisposable);
}
