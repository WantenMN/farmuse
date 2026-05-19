import * as React from "react";

interface CustomScrollbarProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

export function CustomScrollbar({ containerRef }: CustomScrollbarProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const thumbRef = React.useRef<HTMLDivElement>(null);
  const isDraggingRef = React.useRef(false);
  const dragStartYRef = React.useRef(0);
  const dragStartScrollTopRef = React.useRef(0);

  const [el, setEl] = React.useState<HTMLElement | null>(null);
  const elRef = React.useRef<HTMLElement | null>(null);
  elRef.current = el;

  React.useEffect(() => {
    const next = containerRef.current;
    if (next !== elRef.current) {
      elRef.current = next;
      setEl(next);
    }
  });

  const [isDragging, setIsDragging] = React.useState(false);
  const [isHover, setIsHover] = React.useState(false);
  const [isHoverTrack, setIsHoverTrack] = React.useState(false);
  const hoverRef = React.useRef({ content: false, track: false });
  const lastMouseRef = React.useRef<{ x: number; y: number } | null>(null);
  const [ratio, setRatio] = React.useState({ top: 0, thumbHeight: 0 });

  const ratioRef = React.useRef(ratio);
  ratioRef.current = ratio;

  React.useEffect(() => {
    if (!el) return;

    let rafId = 0;
    let moPending = false;

    const update = () => {
      const { scrollHeight, clientHeight, scrollTop } = el;
      if (scrollHeight <= clientHeight + 5) {
        setRatio({ top: 0, thumbHeight: 0 });
        if (thumbRef.current) thumbRef.current.style.transform = "";
        return;
      }
      const wasHidden = ratioRef.current.thumbHeight === 0;
      const th = Math.max(80, (clientHeight / scrollHeight) * clientHeight);
      const maxST = scrollHeight - clientHeight;
      const maxTT = clientHeight - th;
      const top = maxST > 0 ? (scrollTop / maxST) * maxTT : 0;

      if (wasHidden && lastMouseRef.current) {
        const cr = el.getBoundingClientRect();
        const { x, y } = lastMouseRef.current;
        const onTrack =
          x >= cr.right - 12 && x <= cr.right && y >= cr.top && y <= cr.bottom;
        const content =
          onTrack ||
          (x >= cr.left && x <= cr.right && y >= cr.top && y <= cr.bottom);
        hoverRef.current = { content, track: onTrack };
        setIsHover(content);
        setIsHoverTrack(onTrack);
      }

      if (thumbRef.current) {
        thumbRef.current.style.transform = `translateY(${top}px)`;
        thumbRef.current.style.height = `${th}px`;
      }

      ratioRef.current = { top, thumbHeight: th };

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setRatio({ top, thumbHeight: th });
      });
    };

    const scheduleUpdate = () => {
      if (moPending) return;
      moPending = true;
      requestAnimationFrame(() => {
        moPending = false;
        update();
      });
    };

    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(scheduleUpdate);
    mo.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    update();
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [el]);

  React.useEffect(() => {
    let hoverRaf = 0;

    const onMove = (e: MouseEvent) => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      if (isDraggingRef.current && elRef.current) {
        const dy = e.clientY - dragStartYRef.current;
        const el = elRef.current;
        const { scrollHeight, clientHeight } = el;
        const maxST = scrollHeight - clientHeight;
        const th = Math.max(80, (clientHeight / scrollHeight) * clientHeight);
        const maxTT = clientHeight - th;
        if (maxTT > 0) {
          el.scrollTop = dragStartScrollTopRef.current + (dy / maxTT) * maxST;
        }
        return;
      }

      if (!elRef.current || ratioRef.current.thumbHeight === 0) return;

      cancelAnimationFrame(hoverRaf);
      hoverRaf = requestAnimationFrame(() => {
        if (!elRef.current) return;
        const cr = elRef.current.getBoundingClientRect();
        const onTrack =
          e.clientX >= cr.right - 12 &&
          e.clientX <= cr.right &&
          e.clientY >= cr.top &&
          e.clientY <= cr.bottom;
        const onContent =
          e.clientX >= cr.left &&
          e.clientX <= cr.right &&
          e.clientY >= cr.top &&
          e.clientY <= cr.bottom;
        const content = onContent || onTrack;
        if (content !== hoverRef.current.content) {
          hoverRef.current.content = content;
          setIsHover(content);
        }
        if (onTrack !== hoverRef.current.track) {
          hoverRef.current.track = onTrack;
          setIsHoverTrack(onTrack);
        }
      });
    };

    const onUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(hoverRaf);
    };
  }, []);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    const el = elRef.current;
    const r = ratioRef.current;
    if (!el || r.thumbHeight === 0) return;
    e.preventDefault();
    const { scrollHeight, clientHeight } = el;
    const th = Math.max(80, (clientHeight / scrollHeight) * clientHeight);
    const maxST = scrollHeight - clientHeight;
    const maxTT = clientHeight - th;
    const trackRect = e.currentTarget.getBoundingClientRect();
    const cy = e.clientY - trackRect.top;
    if (cy < r.top || cy > r.top + th) {
      const newT = Math.max(0, Math.min(maxTT - th, cy - th / 2));
      el.scrollTop = maxTT > 0 ? (newT / maxTT) * maxST : 0;
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartScrollTopRef.current = el.scrollTop;
    document.body.style.userSelect = "none";
  }, []);

  if (ratio.thumbHeight === 0) return null;

  const active = isHover || isDragging;
  const direct = isHoverTrack || isDragging;

  return (
    <div
      ref={trackRef}
      className="absolute top-0 h-full"
      style={{
        right: 0,
        width: 12,
        zIndex: 10,
        opacity: active ? 1 : 0,
        cursor: isDragging ? "grabbing" : "grab",
        transition: "opacity 0.2s",
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        ref={thumbRef}
        className="absolute top-0 right-0 rounded-full transition-colors"
        style={{
          width: 12,
          height: ratio.thumbHeight,
          backgroundColor: direct
            ? "color-mix(in srgb, var(--foreground) 15%, transparent)"
            : "color-mix(in srgb, var(--foreground) 7%, transparent)",
          willChange: "transform",
          transition: isDragging
            ? "none"
            : "transform 0.05s linear, height 0.05s linear, background-color 0.15s ease",
        }}
      />
    </div>
  );
}
