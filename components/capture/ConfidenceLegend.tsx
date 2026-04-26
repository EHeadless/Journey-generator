'use client';

/**
 * ConfidenceLegend — explains the high/medium/low confidence chips
 * used in SignalReview and QuestionAnswerReview.
 */

const ITEMS: Array<{
  level: 'high' | 'medium' | 'low';
  color: string;
  label: string;
  description: string;
}> = [
  {
    level: 'high',
    color: 'var(--success)',
    label: 'high',
    description: 'directly stated in the transcript with clear citations',
  },
  {
    level: 'medium',
    color: 'var(--accent)',
    label: 'medium',
    description: 'supported but partial, inferred, or hedged',
  },
  {
    level: 'low',
    color: 'var(--fg-3)',
    label: 'low',
    description: 'weakly grounded, ambiguous, or stitched across turns',
  },
];

export function ConfidenceLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-3 py-2 mb-4 rounded-md border text-xs"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--border-1)',
        color: 'var(--fg-2)',
      }}
    >
      <span className="font-semibold" style={{ color: 'var(--fg-2)' }}>
        Confidence:
      </span>
      {ITEMS.map((item) => (
        <span key={item.level} className="flex items-center gap-1.5">
          <span
            className="px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
              color: item.color,
            }}
          >
            {item.label}
          </span>
          <span style={{ color: 'var(--fg-3)' }}>{item.description}</span>
        </span>
      ))}
    </div>
  );
}
