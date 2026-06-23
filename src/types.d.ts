export {};

declare global {
  interface Window {
    electronAPI: {
      pickDirectory: () => Promise<string | null>;
      writeTextFile: (
        folder: string,
        fileName: string,
        text: string
      ) => Promise<void>;
      readTextFile: (
        folder: string,
        fileName: string
      ) => Promise<string | null>;
    };
  }
}