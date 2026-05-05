import React, { useState, useEffect, useRef, useMemo } from "react";
import { commandManager, Command } from "../systems/commandManager";

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCommands = useMemo(() => {
    const all = commandManager.getAllCommands().filter(cmd => cmd.visible !== false);
    if (!query) return all;
    const lowQuery = query.toLowerCase();

    // Fuzzy match helper: checks if characters appear in sequence
    const isFuzzyMatch = (text: string, q: string) => {
      let i = 0, j = 0;
      const t = text.toLowerCase();
      while (i < t.length && j < q.length) {
        if (t[i] === q[j]) j++;
        i++;
      }
      return j === q.length;
    };

    return all.filter(cmd =>
      isFuzzyMatch(cmd.name, lowQuery) ||
      isFuzzyMatch(cmd.description, lowQuery) ||
      isFuzzyMatch(cmd.id, lowQuery)
    );
  }, [query, isOpen]);

  useEffect(() => {
    commandManager.register({
      id: "open-command-palette",
      name: "Open Command Palette",
      description: "Show the command input box at the bottom",
      handler: () => setIsOpen(true),
      visible: false
    });

    return () => {
      commandManager.unregister("open-command-palette");
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.value = "";
          inputRef.current.focus();
        }
      }, 0);
    }
  }, [isOpen]);

  // Handle auto-scroll when selection changes
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth"
        });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      }
    } else if (e.key === "Enter") {
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        commandManager.execute(selected.id);
        setIsOpen(false);
      }
    } else if (e.key === "Tab") {
      e.preventDefault(); // Keep focus on input
      if (filteredCommands.length > 0) {
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/20 z-[9999] flex flex-col justify-end"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-[#1e1e1e] border-t border-[#333] shadow-2xl w-full max-w-2xl mx-auto mb-12 rounded-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Results List */}
        {filteredCommands.length > 0 && (
          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto border-b border-[#333] flex flex-col text-left"
          >
            {filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                  index === selectedIndex ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-[#2d2d2d]"
                }`}
                onClick={() => {
                  commandManager.execute(cmd.id);
                  setIsOpen(false);
                }}
              >
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-sm leading-tight">{cmd.name}</span>
                  <span className={`text-xs mt-1 ${index === selectedIndex ? "text-blue-100" : "text-gray-500"}`}>
                    {cmd.description}
                  </span>
                </div>
                {index === selectedIndex && (
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold shrink-0 ml-4">ENTER</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 bg-[#252526]">
          <div className="flex items-center gap-3">
            <span className="text-blue-500 font-bold text-xl ml-1 shrink-0">&gt;</span>
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-white outline-none text-lg placeholder:text-gray-600"
              placeholder="Search commands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
