# Agent Guidelines

- **Package Management**: When installing or adding npm dependencies, always use **Deno**.
  - Example: `deno add npm:<package-name>`
- **Keyboard Control**: This project aims for a full keyboard-driven experience. Avoid adding UI elements that rely solely on mouse interaction (like close buttons) unless specifically requested.
- **UI Components**: Prioritize using existing components from **shadcn/ui** for any UI construction. Only consider creating custom components if a suitable one does not exist in the library.
