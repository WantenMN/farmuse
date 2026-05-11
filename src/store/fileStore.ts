import { create } from "zustand";

interface FileState {
  cutPath: string | null;
  setCutPath: (path: string | null) => void;
}

export const useFileStore = create<FileState>((set) => ({
  cutPath: null,
  setCutPath: (path) => set({ cutPath: path }),
}));
