import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props<T> {
  items: T[];
  rowHeight: number;
  height: number | string;
  overscan?: number;
  render: (item: T, index: number) => ReactNode;
  getKey: (item: T) => string;
  label: string;
}

/** Minimal fixed-row-height windowing: only visible rows are in the DOM. */
export default function VirtualList<T>({ items, rowHeight, height, overscan = 6, render, getKey, label }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [items]);

  const first = Math.max(0, Math.floor(top / rowHeight) - overscan);
  const last = Math.min(items.length, Math.ceil((top + viewport) / rowHeight) + overscan);

  return (
    <div ref={ref} role="list" aria-label={label} style={{ height, overflowY: "auto", overscrollBehavior: "contain" }}
      onScroll={e => setTop(e.currentTarget.scrollTop)}>
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        {items.slice(first, last).map((item, i) => (
          <div role="listitem" key={getKey(item)} style={{ position: "absolute", top: (first + i) * rowHeight, height: rowHeight, left: 0, right: 0 }}>
            {render(item, first + i)}
          </div>
        ))}
      </div>
    </div>
  );
}
