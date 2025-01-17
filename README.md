# Component Directories

A Visual Studio Code extension that streamlines component creation and management through customizable templates. Framework-agnostic - use it with any component-based project structure!

## Features

- **Framework Agnostic**: Create components for any framework or library using customizable templates
- **Template-Based Component Generation**: Generate components using predefined templates
- **Multiple Component Types**: Support for different component structures through template groups
- **Hierarchical Configuration**: Define different templates for different parts of your project using directory-specific configurations
- **Component Management**: Rename components and add new files to existing components
- **Configurable Templates**: Customize component templates through a JSON configuration file
- **Smart Import Updates**: Automatically updates import statements when renaming components (for TypeScript/JavaScript projects)

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
  "replacements": {
    "__COMPONENT_NAME__": "componentName"
  },
  "mainTemplates": [
    {
      "source": "component.template",
      "target": "${componentName}/${componentName}",
      "label": "Component"
    }
  ],
  "alternateTemplateGroups": [
    {
      "label": "Simple Component",
      "templates": [
        {
          "source": "simple.template",
          "target": "${componentName}/${componentName}",
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

## Template Structure

Templates should be placed in the configured templates directory. Each template can use these variables:

- `__COMPONENT_NAME__`: Replaced with the component name
- Custom variables defined in the `replacements` configuration

Your templates can include any file types or structures needed for your framework or language of choice.

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

[Add your chosen license here]
