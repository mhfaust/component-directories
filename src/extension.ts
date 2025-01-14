// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    'extension.createReactComponent',
    async (uri: vscode.Uri) => {
      // Check if the path is null or undefined.
      if (!uri || !uri.fsPath) {
        vscode.window.showErrorMessage('Please right-click a directory to generate the component.');
        return;
      }

      const componentName = await vscode.window.showInputBox({
        prompt: 'Component name in PascalCase',
        placeHolder: 'e.g. MyComponent',
      });

      if (!componentName) {
        return;
      }

      const componentDir = vscode.Uri.file(`${uri.fsPath}/${componentName}`);

      try {
        await vscode.workspace.fs.createDirectory(componentDir);
        await createComponentFiles(componentDir, componentName);

        vscode.window.showInformationMessage(`${componentName} component created successfully!`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to create component: ${error.message}`);
      }
    },
  );

  context.subscriptions.push(disposable);
}

async function createComponentFiles(componentDir: vscode.Uri, componentName: string) {
  const indexFile = vscode.Uri.joinPath(componentDir, 'index.ts');
  const componentFile = vscode.Uri.joinPath(componentDir, `${componentName}.tsx`);
  const styleFile = vscode.Uri.joinPath(componentDir, `${componentName}.css`);

  const indexContent = `export { default } from './${componentName}';\n`;
  const componentContent = `import React from 'react';
import './${componentName}.css'

interface Props {
// Add component props here
}

const ${componentName}: React.FC<Props> = ({}) => {
  return (
      <div>
          <h1>${componentName} Component</h1>
      </div>
  );
};

export default ${componentName};
`;
  const styleContent = `/* ${componentName}.css */
`;
  await vscode.workspace.fs.writeFile(indexFile, Buffer.from(indexContent, 'utf-8'));
  await vscode.workspace.fs.writeFile(componentFile, Buffer.from(componentContent, 'utf-8'));
  await vscode.workspace.fs.writeFile(styleFile, Buffer.from(styleContent, 'utf-8'));
}

// This method is called when your extension is deactivated
export function deactivate() {}
