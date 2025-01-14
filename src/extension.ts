import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TemplateConfig {
  templatesDir: string;
  replacements: { [key: string]: string };
  templates: {
    source: string;
    target: string;
  }[];
}

async function loadConfig(workspaceRoot: string): Promise<TemplateConfig | null> {
  try {
    const configPath = path.join(workspaceRoot, '.component-templates.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    vscode.window.showErrorMessage(
      'Could not load component templates configuration. Please ensure .component-templates.json exists in your workspace root.',
    );
    return null;
  }
}

async function generateComponent(
  componentName: string,
  targetDir: string,
  config: TemplateConfig,
  workspaceRoot: string,
) {
  const templatesPath = path.join(workspaceRoot, config.templatesDir);

  for (const template of config.templates) {
    // Read template file
    const templateContent = await fs.readFile(path.join(templatesPath, template.source), 'utf-8');

    // Replace all tokens in content
    let processedContent = templateContent;
    for (const [token, replacement] of Object.entries(config.replacements)) {
      processedContent = processedContent.replaceAll(
        token,
        replacement === 'componentName' ? componentName : replacement,
      );
    }

    // Process target path
    const processedTarget = template.target.replaceAll('${componentName}', componentName);
    const targetPath = path.join(targetDir, processedTarget);

    // Ensure directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Write file
    await fs.writeFile(targetPath, processedContent);
  }
}

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    'extension.createReactComponent',
    async (uri: vscode.Uri) => {
      if (!uri || !uri.fsPath) {
        vscode.window.showErrorMessage('Please right-click a directory to generate the component.');
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      const config = await loadConfig(workspaceRoot);
      if (!config) {
        return;
      }

      const componentName = await vscode.window.showInputBox({
        prompt: 'Component name in PascalCase',
        placeHolder: 'e.g. MyComponent',
        validateInput: (value) => {
          if (!/^[A-Z][A-Za-z0-9]*$/.test(value)) {
            return 'Component name must be in PascalCase';
          }
          return null;
        },
      });

      if (!componentName) {
        return;
      }

      try {
        await generateComponent(componentName, uri.fsPath, config, workspaceRoot);
        vscode.window.showInformationMessage(`Component ${componentName} created successfully!`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error generating component: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  context.subscriptions.push(disposable);
}
