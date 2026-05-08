# Agent Guidelines

- **Package Management**: When installing or adding npm dependencies, always use **Deno**.
  - Example: `deno add npm:<package-name>`
- **Keyboard Control**: This project aims for a full keyboard-driven experience. Avoid adding UI elements that rely solely on mouse interaction (like close buttons) unless specifically requested.
- **UI Components**: Prioritize using existing components from **shadcn/ui** for any UI construction. Only consider creating custom components if a suitable one does not exist in the library.
- **Code Quality**: After every code modification, you must run `deno task lint`. If there are any errors or warnings, fix them until the linting passes completely. Once linting is clean, run `deno task format` to ensure consistent code styling.
