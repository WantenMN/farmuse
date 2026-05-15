# Project Guidelines

## Package Management
When installing or adding npm dependencies, always use **Deno**.
- Example: `deno add npm:<package-name>`

## UI Components
Prioritize using existing components from **shadcn/ui** for any UI construction. Only consider creating custom components if a suitable one does not exist in the library.

## Code Quality
After every code modification:
1. Run `npx tsc --noEmit` to type-check.
2. Run `deno task lint` — fix any errors or warnings until linting passes completely.
3. Run `deno task format` for consistent styling.
