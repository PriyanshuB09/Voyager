export {};

declare global {
  interface Window {
    electronAPI: {
      windowControl: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
    };
  }
}