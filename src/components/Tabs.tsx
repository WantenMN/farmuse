import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface Tab {
  path: string;
  name: string;
}

interface TabsProps {
  files: Tab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseOthers: (path: string) => void;
  onCloseAll: () => void;
}

export function Tabs({
  files,
  activePath,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
}: TabsProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-scroll active tab into view
  React.useEffect(() => {
    if (!activePath) return;
    const el = tabRefs.current.get(activePath);
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activePath]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="bg-muted/10 no-scrollbar flex min-h-[36px] w-full items-stretch overflow-x-auto overflow-y-hidden border-b select-none"
      >
        {files.map((file) => {
          const isActive = file.path === activePath;
          return (
            <ContextMenu key={file.path}>
              <ContextMenuTrigger asChild>
                <div
                  ref={(el) => {
                    if (el) tabRefs.current.set(file.path, el);
                    else tabRefs.current.delete(file.path);
                  }}
                  className={cn(
                    "group relative flex min-w-[120px] shrink-0 cursor-pointer items-center gap-2 border-r px-3 text-xs transition-colors",
                    isActive
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:bg-muted/30"
                  )}
                  onClick={() => onSelect(file.path)}
                >
                  <span className="whitespace-nowrap">
                    {file.name.replace(/\.md$/, "")}
                  </span>
                  <button
                    className={cn(
                      "ml-auto cursor-pointer rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                      isActive
                        ? "hover:bg-muted-foreground/20 bg-transparent opacity-100"
                        : "hover:bg-muted-foreground/15"
                    )}
                    title="Close"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(file.path);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {isActive && (
                    <div className="bg-primary absolute bottom-[-1px] left-0 h-[2px] w-full" />
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => onClose(file.path)}>
                  Close
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onCloseOthers(file.path)}>
                  Close Others
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onCloseAll()}>
                  Close All
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
      <TabScrollbar containerRef={containerRef} />
    </div>
  );
}

function TabScrollbar({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const isDraggingRef = React.useRef(false);
  const dragStartXRef = React.useRef(0);
  const dragStartScrollLeftRef = React.useRef(0);
  const inZoneRef = React.useRef(false);

  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    setEl(containerRef.current);
  }, [containerRef]);

  const [isTabsHover, setIsTabsHover] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHoverActive, setIsHoverActive] = React.useState(false);
  const [ratio, setRatio] = React.useState({ left: 0, thumbWidth: 0 });

  // Track scroll & overflow
  React.useEffect(() => {
    if (!el) return;
    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = el;
      if (scrollWidth <= clientWidth + 1) {
        setRatio({ left: 0, thumbWidth: 0 });
        return;
      }
      const tw = Math.max(20, (clientWidth / scrollWidth) * clientWidth);
      const maxSL = scrollWidth - clientWidth;
      const maxTL = clientWidth - tw;
      setRatio({
        left: maxSL > 0 ? (scrollLeft / maxSL) * maxTL : 0,
        thumbWidth: tw,
      });
    };
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [el]);

  // Wheel → horizontal scroll
  React.useEffect(() => {
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [el]);

  // Tabs hover listeners (for thin indicator)
  React.useEffect(() => {
    if (!el) return;
    const enter = () => setIsTabsHover(true);
    const leave = () => setIsTabsHover(false);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
    };
  }, [el]);

  // Drag — listeners always attached, ref-based gate
  const ratioRef = React.useRef(ratio);
  ratioRef.current = ratio;
  const elRef = React.useRef(el);
  elRef.current = el;

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !elRef.current) return;
      const dx = e.clientX - dragStartXRef.current;
      const el = elRef.current;
      const { scrollWidth, clientWidth } = el;
      const maxSL = scrollWidth - clientWidth;
      const tw = Math.max(20, (clientWidth / scrollWidth) * clientWidth);
      const maxTL = clientWidth - tw;
      if (maxTL > 0) {
        el.scrollLeft = dragStartScrollLeftRef.current + (dx / maxTL) * maxSL;
      }
    };
    const onUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Proximity detection for thick scrollbar — global, no dependency on tabs hover
  React.useEffect(() => {
    const DELAY = 300;

    const onMove = (e: MouseEvent) => {
      if (!elRef.current || ratioRef.current.thumbWidth === 0) return;

      const cr = elRef.current.getBoundingClientRect();
      const sbTop = cr.bottom + 2;
      const inZone =
        e.clientX >= cr.left &&
        e.clientX <= cr.right &&
        e.clientY >= sbTop &&
        e.clientY <= sbTop + 16;

      inZoneRef.current = inZone;

      if (inZone) {
        if (!isHoverActive && !hoverTimerRef.current) {
          hoverTimerRef.current = setTimeout(() => {
            hoverTimerRef.current = null;
            if (inZoneRef.current) setIsHoverActive(true);
          }, DELAY);
        }
      } else {
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        if (isHoverActive) setIsHoverActive(false);
      }
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [isHoverActive]);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    const el = elRef.current;
    const r = ratioRef.current;
    if (!el || r.thumbWidth === 0) return;
    e.preventDefault();
    const { scrollWidth, clientWidth } = el;
    const tw = Math.max(20, (clientWidth / scrollWidth) * clientWidth);
    const maxSL = scrollWidth - clientWidth;
    const maxTL = clientWidth - tw;
    // Use getBoundingClientRect so offset is relative to track, not any child
    const trackRect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - trackRect.left;
    if (cx < r.left || cx > r.left + tw) {
      const newL = Math.max(0, Math.min(maxTL - tw, cx - tw / 2));
      el.scrollLeft = maxTL > 0 ? (newL / maxTL) * maxSL : 0;
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = el.scrollLeft;
    document.body.style.userSelect = "none";
  }, []);

  if (ratio.thumbWidth === 0) return null;

  const active = isHoverActive || isDragging;

  return (
    <>
      {/* Thin indicator — only on tabs hover, non-interactive */}
      <div
        className="pointer-events-none absolute left-0 w-full"
        style={{
          top: 38,
          height: 2,
          opacity: isTabsHover && !active ? 1 : 0,
          transition: "opacity 0.2s",
        }}
      >
        <div
          className="bg-foreground/10 absolute rounded-full"
          style={{
            width: ratio.thumbWidth,
            height: 2,
            left: ratio.left,
          }}
        />
      </div>

      {/* Thick interactive scrollbar — proximity-based, draggable */}
      <div
        className="absolute left-0 w-full"
        style={{
          top: 39,
          height: 16,
          zIndex: 10,
          opacity: active ? 1 : 0,
          cursor: active ? (isDragging ? "grabbing" : "grab") : "",
          transition: "opacity 0.2s",
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="bg-foreground/15 absolute rounded-full"
          style={{
            width: ratio.thumbWidth,
            height: 16,
            left: ratio.left,
            bottom: 0,
            transition: isDragging ? undefined : "left 0.05s",
          }}
        />
      </div>
    </>
  );
}
