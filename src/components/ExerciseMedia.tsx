import { useState } from "react";
import { useApp } from "../app-context";
import { frameUrl } from "../library/data";
import type { Exercise } from "../library/types";

/**
 * Shows an exercise's media: a user/real GIF or MP4 if attached, else the two dataset frames
 * crossfading in a loop (behaves like a GIF), else a clean placeholder.
 */
export default function ExerciseMedia({ ex, size = 96, lazy = true }: { ex: Exercise; size?: number | string; lazy?: boolean }) {
  const { t } = useApp();
  const [failed, setFailed] = useState(false);
  const dim = typeof size === "number" ? { width: size, height: size } : { width: size, aspectRatio: "1" };
  const box = { ...dim, borderRadius: 10, background: "var(--bg)", overflow: "hidden", position: "relative" as const, flex: "none" as const };

  if (ex.media?.kind === "mp4" )
    return <div style={box}><video src={ex.media.url} muted loop autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} aria-label={t("lib.media.alt")} /></div>;
  if (ex.media)
    return <div style={box}><img src={ex.media.url} alt={t("lib.media.alt")} loading={lazy ? "lazy" : undefined} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;

  if (ex.frames > 0 && !failed)
    return (
      <div style={box} className="xfade" data-frames={ex.frames}>
        <img src={frameUrl(ex.id, 0)} alt="" loading={lazy ? "lazy" : undefined} decoding="async" onError={() => setFailed(true)} />
        {ex.frames > 1 && <img className="xfade-b" src={frameUrl(ex.id, 1)} alt="" loading={lazy ? "lazy" : undefined} decoding="async" onError={() => setFailed(true)} />}
      </div>
    );

  return (
    <div style={{ ...box, display: "grid", placeItems: "center", color: "var(--muted)" }} aria-hidden="true">
      <svg width={typeof size === "number" ? size * 0.5 : 64} height={typeof size === "number" ? size * 0.5 : 64} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />
      </svg>
    </div>
  );
}
