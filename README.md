# Component Directories

A Visual Studio Code extension that streamlines component creation and management through customizable templates. Framework-agnostic - use it with any component-based project structure!

## Features

- **Framework Agnostic**: Create components for any framework or library using customizable templates
- **Template-Based, Configurable Sets**: Generate components using predefined sets of templates, configured via JSON
- **Hierarchical Configuration**: Define different template Groups for different parts of your project using directory-specific JSON configurations
- **Component Management**: Rename components and add new files to existing components
- **Smart Import Updates**: Automatically updates import statements when renaming components (for TypeScript/JavaScript projects)

## Quick Start

1. Install from VS Code marketplace: search for "Component Directories"
2. Create `.component-templates.json` in your project root
3. Create a `component-templates` directory with your template files
4. Right-click any folder in VS Code's explorer and select "Component > Create..."

## Getting Started

1. Install the extension from the VS Code marketplace
2. Create a `.component-templates.json` configuration file in your project root
3. Right-click in the explorer to access component generation commands

## Configuration

The extension uses `.component-templates.json` files for configuration. These can be placed at any level in your project hierarchy - the extension will look for the nearest configuration file in the current or any parent directory. This allows you to:

- Use different component templates for different parts of your project
- Override project-wide templates with sub-directory specific ones
- Maintain separate component structures for different modules or packages

Create a `.component-templates.json` file in any directory where you want to define component templates:

```json
{
  "templatesDir": "./component-templates",
  "componentNamePattern": "^[A-Z][a-zA-Z0-9]*$",
  "defaultTemplateGroup": [
    {
      "source": "component.template",
      "target": "{{COMPONENT_NAME}}/{{COMPONENT_NAME}}",
      "label": "Component"
    }
  ],
  "alternateTemplateGroups": [
    {
      "label": "Simple Component",
      "templates": [
        {
          "source": "simple.template",
          "target": "{{COMPONENT_NAME}}/{{COMPONENT_NAME}}",
          "label": "Simple Component"
        }
      ]
    }
  ]
}
```

## Commands

Right-click in the explorer to access these commands under the "Component" menu:

- **Create (Full)**: Generate a component using all main templates
- **Create (Choose Type)...**: Create a component selecting from alternate template groups
- **Rename**: Rename a component and update its imports throughout the project (TypeScript/JavaScript projects only)
- **Add Files...**: Add additional template-based files to an existing component

## Template Usage

The `{{COMPONENT_NAME}}` token is used both in template file paths and template content:

In `.component-templates.json`:

```json
{
  "defaultTemplateGroup": [
    {
      "source": "component.tsx.template",
      "target": "{{COMPONENT_NAME}}/{{COMPONENT_NAME}}.tsx",
      "label": "Component"
    }
  ]
}

## Development

### Prerequisites

- Node.js
- Visual Studio Code

### Setup

1. Clone the repository
2. Run `npm install`
3. Open the project in VS Code
4. Press F5 to start debugging

### Available Scripts

- `npm run compile`: Compile TypeScript files
- `npm run watch`: Watch for file changes and recompile
- `npm run lint`: Run ESLint
- `npm test`: Run tests

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
```
