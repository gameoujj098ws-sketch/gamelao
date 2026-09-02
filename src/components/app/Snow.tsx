import { useMemo } from "react";

/** Subtle snowfall layer — decorative only, never blocks interaction. */
export function Snow({ count = 18 }: { count?: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 100) / count + (i % 3) * 1.7,
        delay: (i * 1.3) % 12,
        duration: 12 + ((i * 3) % 9),
        size: 4 + (i % 4) * 2,
        opacity: 0.25 + ((i % 5) * 0.09),
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {flakes.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
