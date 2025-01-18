# Change Log

All notable changes to the "Component Directories" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-17

### Added

- Initial release with core component management functionality
- Framework-agnostic template system using `.component-templates.json` configuration
- Hierarchical configuration support - configs can be placed at any directory level
- Component creation commands:
  - Create components using default template group
  - Create components with alternate template groups
  - Add new files to existing components from available templates
- Automatic component renaming with TypeScript/JavaScript import updates
- Template variable substitution system
- Comprehensive template validation on load
- Error handling with detailed output channel logging
- Explorer context menu integration with dedicated Component submenu
- Support for multiple template groups with different file structures

### Changed

- Updated from pre-release version 0.0.2 to initial public release

### Security

- Restricted filesystem access to workspace directories only
- Template operations confined to component target directories

### Developer Notes

This initial release provides a stable foundation for component management while remaining framework-agnostic. The version number reflects a feature-complete but newly-released extension that would benefit from community feedback and real-world usage before advancing to 1.0.0.
