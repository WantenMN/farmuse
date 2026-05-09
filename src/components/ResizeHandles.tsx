import { getCurrentWindow } from "@tauri-apps/api/window";

export function ResizeHandles() {
  const appWindow = getCurrentWindow();

  const handleResize = (
    edge:
      | "East"
      | "North"
      | "NorthEast"
      | "NorthWest"
      | "South"
      | "SouthEast"
      | "SouthWest"
      | "West"
  ) => {
    appWindow.startResizeDragging(edge);
  };

  return (
    <>
      {/* Edges - 4px hit area */}
      <div
        className="fixed top-0 right-0 left-0 z-[9999] h-1.5 cursor-n-resize"
        onMouseDown={(e) => {
          if (e.button === 0) handleResize("North");
        }}
      />
      <div
        className="fixed right-0 bottom-0 left-0 z-[9999] h-1.5 cursor-s-resize"
        onMouseDown={(e) => {
          if (e.button === 0) handleResize("South");
        }}
      />
      <div
        className="fixed top-0 bottom-0 left-0 z-[9999] w-1.5 cursor-w-resize"
        onMouseDown={(e) => {
          if (e.button === 0) handleResize("West");
        }}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-[9999] w-1.5 cursor-e-resize"
        onMouseDown={(e) => {
          if (e.button === 0) handleResize("East");
        }}
      />

      {/* Corners - 6px hit area */}
      <div
        className="fixed top-0 left-0 z-[10000] h-4 w-4 cursor-nw-resize"
        onMouseDown={(e) => {
          if (e.button === 0) handleResize("NorthWest");
        }}
      />
      <div
        className="fixed top-0 right-0 z-[10000] h-4 w-4 cursor-ne-resize"
        onMouseDown={(e) => {
          if (e.button === 0) handleResize("NorthEast");
        }}
      />
      <div
        className="fixed bottom-0 left-0 z-[10000] h-4 w-4 cursor-sw-resize"
        onMouseDown={(e) => {
          if (e.button === 0) handleResize("SouthWest");
        }}
      />
      <div
        className="fixed right-0 bottom-0 z-[10000] h-4 w-4 cursor-se-resize"
        onMouseDown={(e) => {
          if (e.button === 0) handleResize("SouthEast");
        }}
      />
    </>
  );
}
