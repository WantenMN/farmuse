import { CommandPalette } from "./components/CommandPalette";

function App() {
  return (
    <main className="container mx-auto p-4 text-center">
      <h1 className="text-3xl font-bold underline">Farmuse</h1>
      <p className="mt-4 text-gray-600">
        Press <kbd className="bg-gray-200 px-1 rounded shadow-sm border">Alt + X</kbd> to open command palette
      </p>

      {/* The Command Palette is always available globally */}
      <CommandPalette />
    </main>
  );
}

export default App;
