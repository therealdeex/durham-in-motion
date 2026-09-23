"use client";

/**
 * Timeline scrubber for story exploration: a range input bound to the day's
 * bins, a play/pause stepper, and optional labeled marks. All keyboard
 * operable; stepping is discrete by design (no interpolation).
 */
export function StoryTimeline({
  value,
  min,
  max,
  step = 1,
  marks,
  label,
  playing,
  onPlayToggle,
  onScrub,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Ticks to label under the track, as fractions of the range (0–1). */
  marks?: { at: number; label: string }[];
  label: string;
  playing: boolean;
  onPlayToggle: () => void;
  onScrub: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPlayToggle}
          aria-pressed={playing}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-walk/60 bg-walk/10 text-walk transition-colors hover:bg-walk/20"
        >
          <span aria-hidden className="text-sm">{playing ? "❚❚" : "▶"}</span>
          <span className="sr-only">{playing ? "Pause the day" : "Play the day"}</span>
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label={label}
          className="h-2 w-full cursor-ew-resize appearance-none rounded-full bg-night-line accent-[#f5b043]"
        />
      </div>
      {marks && marks.length > 0 && (
        <div className="relative mt-1 h-4 text-[10px] text-chalk-dim">
          {marks.map((m) => (
            <span key={m.label} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${m.at * 100}%` }}>
              {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
