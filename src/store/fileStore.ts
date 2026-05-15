import { create } from "zustand";

interface FileState {
  cutPath: string | null;
  copyPath: string | null;
  setCutPath: (path: string | null) => void;
  setCopyPath: (path: string | null) => void;
}

const MULTI_SEP = "\n";

export const encodeMultiPaths = (paths: string[]) =>
  paths.length === 1 ? paths[0] : paths.join(MULTI_SEP);

export const decodeMultiPaths = (raw: string | null): string[] => {
  if (!raw) return [];
  if (raw.includes(MULTI_SEP)) return raw.split(MULTI_SEP);
  return [raw];
};

export const isMultiPath = (raw: string | null) =>
  !!raw && raw.includes(MULTI_SEP);

export const useFileStore = create<FileState>((set) => ({
  cutPath: null,
  copyPath: null,
  setCutPath: (path) => set({ cutPath: path, copyPath: null }),
  setCopyPath: (path) => set({ copyPath: path, cutPath: null }),
}));
