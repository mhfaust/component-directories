import * as vscode from 'vscode';
import { renameCommand } from './commands/rename';
import { createWithDefaultFiles } from './commands/createWithDefaultFiles';
import { addFiles } from './commands/addFiles';
import { createAltComponent } from './commands/createWithAltFiles';
import { forkComponentCommand } from './commands/forkComponent';

export function activate(context: vscode.ExtensionContext) {
  const createAltComponentDisposable = vscode.commands.registerCommand(
    'extension.createAltComponent',
    createAltComponent,
  );

  const addFilesDisposable = vscode.commands.registerCommand(
    'extension.addComponentFiles',
    addFiles,
  );

  const createDefaultDisposable = vscode.commands.registerCommand(
    'extension.createDefault',
    createWithDefaultFiles,
  );

  const renameDisposable = vscode.commands.registerCommand(
    'extension.renameComponent',
    renameCommand,
  );

  const forkComponentDisposable = vscode.commands.registerCommand(
    'extension.forkComponent',
    forkComponentCommand,
  );

  context.subscriptions.push(createDefaultDisposable);
  context.subscriptions.push(renameDisposable);
  context.subscriptions.push(createAltComponentDisposable);
  context.subscriptions.push(addFilesDisposable);
  context.subscriptions.push(forkComponentDisposable);
}
