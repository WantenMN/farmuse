import { create } from "zustand";

interface FileState {
  cutPath: string | null;
  copyPath: string | null;
  setCutPath: (path: string | null) => void;
  setCopyPath: (path: string | null) => void;
}

export const useFileStore = create<FileState>((set) => ({
  cutPath: null,
  copyPath: null,
  setCutPath: (path) => set({ cutPath: path, copyPath: null }),
  setCopyPath: (path) => set({ copyPath: path, cutPath: null }),
}));
