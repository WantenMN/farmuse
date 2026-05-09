import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  fontSize: number;
  setFontSize: (fontSize: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontSize: 18,
      setFontSize: (fontSize) => set({ fontSize }),
    }),
    {
      name: "farmuse_settings",
    }
  )
);
