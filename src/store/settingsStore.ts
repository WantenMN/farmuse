import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  fontSize: number;
  showLineNumbers: boolean;
  setFontSize: (fontSize: number) => void;
  setShowLineNumbers: (showLineNumbers: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontSize: 18,
      showLineNumbers: true,
      setFontSize: (fontSize) => set({ fontSize }),
      setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
    }),
    {
      name: "farmuse_settings",
    }
  )
);
