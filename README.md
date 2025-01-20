# Component Directories

A VS Code extension for generating and managing component directories. While designed with React components in mind, it's framework-agnostic and can be used for any project that follows a component-based architecture.

## Features

- Create component directories with multiple files from templates
- Add additional files to existing components
- Rename components (including updating imports)
- Support for multiple template groups
- Smart case transformations for component names
- Framework agnostic

## Quick Start

1. Install from VS Code marketplace: search for "Component Directories"
2. Create `.component-templates.json` in your project root
3. Create a directory next to your config file to store your templates (e.g., "component-templates")
4. Right-click any folder in VS Code's explorer and select "Component > Create..."

## Getting Started

1. Install the extension from the VS Code marketplace
2. Create a `.component-templates.json` configuration file in your project root
3. Create your template directory as a sibling to your config file
4. Right-click in the explorer to access component generation commands

## Configuration

Create a `.component-templates.json` file in your project root or any parent directory of where you'll be creating components.

### Basic Configuration Example

```json
{
  "templatesDirectory": "component-templates",
  "directoryCase": "pascal",
  "defaultTemplateGroup": ["component.tsx.template", "index.ts.template", "styles.scss.template"],
  "templates": [
    {
      "source": "component.tsx.template",
      "target": "{{PascalCaseComponentName}}.tsx",
      "label": "Component"
    },
    {
      "source": "index.ts.template",
      "target": "index.ts",
      "label": "Index"
    },
    {
      "source": "styles.scss.template",
      "target": "{{PascalCaseComponentName}}.module.scss",
      "label": "Styles"
    }
  ]
}
```

### Configuration Properties

- `templatesDirectory`: Directory containing template files (relative to config file location)
- `directoryCase` (optional): Specifies the case format for component directories. Can be one of: "pascal", "camel", "kebab", or "snake"
- `defaultTemplateGroup`: Array of template sources to use for the default "Create..." command
- `alternateTemplateGroups` (optional): Array of named template groups for the "Create (choose file set)..." command
- `templates`: Array of template configurations with the following properties:
  - `source`: Template file name in the templates directory
  - `target`: Output file name (can include case-sensitive tokens)
  - `label`: Display name for the template in the UI

### Case Transformation Tokens

You can use these tokens in template files and target filenames for automatic case transformation:

- `{{PascalCaseComponentName}}` → MyComponent
- `{{camelCaseComponentName}}` → myComponent
- `{{kebab-case-component-name}}` → my-component
- `{{snake_case_component_name}}` → my_component

### Advanced Configuration Example

```json
{
  "templatesDirectory": "component-templates",
  "directoryCase": "pascal",
  "defaultTemplateGroup": [
    "component.tsx.template",
    "index.ts.template",
    "styles.scss.template",
    "test.tsx.template"
  ],
  "alternateTemplateGroups": [
    {
      "label": "Simple Component",
      "templates": ["component-simple.tsx.template", "index.ts.template"]
    },
    {
      "label": "Full Feature Set",
      "templates": [
        "component.tsx.template",
        "index.ts.template",
        "styles.scss.template",
        "test.tsx.template",
        "types.ts.template"
      ]
    }
  ],
  "templates": [
    {
      "source": "component.tsx.template",
      "target": "{{PascalCaseComponentName}}.tsx",
      "label": "Component"
    },
    {
      "source": "component-simple.tsx.template",
      "target": "{{PascalCaseComponentName}}.tsx",
      "label": "Simple Component"
    },
    {
      "source": "index.ts.template",
      "target": "index.ts",
      "label": "Index"
    },
    {
      "source": "styles.scss.template",
      "target": "{{PascalCaseComponentName}}.module.scss",
      "label": "Styles"
    },
    {
      "source": "test.tsx.template",
      "target": "{{PascalCaseComponentName}}.test.tsx",
      "label": "Test"
    },
    {
      "source": "types.ts.template",
      "target": "types.ts",
      "label": "Types"
    }
  ]
}
```

## Template Examples

### Component Template (component.tsx.template)

```tsx
import styles from './{{PascalCaseComponentName}}.module.scss';

type {{PascalCaseComponentName}}Props = {};

const {{PascalCaseComponentName}} = ({}: {{PascalCaseComponentName}}Props) => {
  return <div className={styles.{{camelCaseComponentName}}}></div>;
};

export default {{PascalCaseComponentName}};
```

### Style Template (styles.scss.template)

```scss
.{{camelCaseComponentName}} {

}
```

### Index Template (index.ts.template)

```ts
export { default } from './{{PascalCaseComponentName}}';
```

### Test Template (test.tsx.template)

```tsx
import { render } from '@testing-library/react';
import {{PascalCaseComponentName}} from './{{PascalCaseComponentName}}';

describe('{{PascalCaseComponentName}}', () => {
  it('renders without crashing', () => {
    render(<{{PascalCaseComponentName}} />);
  });
});
```

## Usage

### Commands

Right-click in the file explorer to access these commands:

1. **Create...**

   - Creates a new component using the default template group
   - Component name can be in PascalCase, camelCase, kebab-case, or snake_case

2. **Create (choose file set)...**

   - Creates a new component after selecting from available template groups
   - Shows template groups defined in `alternateTemplateGroups`

3. **Add Files...**

   - Adds additional files to an existing component
   - Shows available templates from all groups

4. **Rename...**
   - Renames a component directory and all its files
   - Updates imports across the workspace
   - Preserves case variations in files and content

### Component Name Formats

Component names can be provided in any of these formats:

- PascalCase: `MyComponent`
- camelCase: `myComponent`
- kebab-case: `my-component`
- snake_case: `my_component`

The extension will automatically transform the name to the appropriate case based on:

- The `directoryCase` setting for the component directory
- The token used in template files and target file names

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
