import Link from "next/link";

/** Source note under visualizations — small, precise, practitioner-friendly. */
export function SourceNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-xs leading-relaxed text-ink-faint dark-section:text-chalk-dim">
      {children}
    </p>
  );
}

export function SuppressionNote() {
  return (
    <p className="mt-3 rounded-md border border-line bg-paper-dim px-3 py-2 text-xs leading-relaxed text-ink-soft dark-section:border-night-line dark-section:bg-night-soft dark-section:text-chalk-dim">
      Cells marked <em>suppressed</em> had fewer than four survey records. They are shown as
      unknown — never as zero. See{" "}
      <Link href="/methodology/" className="font-medium underline decoration-accent underline-offset-2">
        How to read this
      </Link>
      .
    </p>
  );
}
