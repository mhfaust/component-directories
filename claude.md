I am authoring an extension for VSCocde called "Component Directories". This extension adds a context sub-menu to the file-explorer with commands for generating and editing the names of components in coding projects. By component I mean a collections of files bound by a containing directory that comprise a focussed piece of functionality. My use of this will be within React applications, but I'd like to keep it generalizable as much as possible, since many coding frameworks support a simlilar component-driven organization paradigm (sometimes referred to as "feature-files").

I would like your assistance in further developing this VSCode extension.

I am including up-to-date and relevant code files and the README as Project knowledge. Please refer to the README to understand how this VSCode extension is intended to work.

The most recent versions of files in Project Knowledge are organized in their respective projects in this way:

Extension Project Files:

```
package.json
src/
  commands/
    addFiles.ts
    createWithAltFiles.ts
    createWithDefaultFiles.ts
    rename.ts
  extension.ts
  extension.test.ts
  utils/
    caseUtils.ts
    configurationUtils.ts
    generationUtils.ts
.prettierrc
eslint.config.mjs
tsconfig.json
README.md
```

Example Consuming Project Files:

```
src/
  components/
    .component-templates.json
    component-templates/
      component.tsx.template
      index.ts.template
      styles.scss.d.ts.template
      styles.scss.template
      test.tsx.template
```
