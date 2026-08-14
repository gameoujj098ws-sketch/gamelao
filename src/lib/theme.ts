/** Turn an admin-chosen hex color into a small set of CSS variable overrides. */
export function themeVars(hex?: string | null): React.CSSProperties | undefined {
  if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim())) return undefined;
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const fg = lum > 0.55 ? "#111111" : "#ffffff";
  return {
    ["--primary" as string]: `#${h}`,
    ["--brand" as string]: `#${h}`,
    ["--ring" as string]: `#${h}`,
    ["--primary-foreground" as string]: fg,
    ["--brand-foreground" as string]: fg,
  } as React.CSSProperties;
}

/** Preset swatches offered in the admin settings panel. */
export const THEME_PRESETS: { label: string; hex: string }[] = [
  { label: "ຟ້າ", hex: "#3b6cf6" },
  { label: "ມ່ວງ", hex: "#7c3aed" },
  { label: "ຂຽວ", hex: "#10b981" },
  { label: "ແດງ", hex: "#ef4444" },
  { label: "ດຳ", hex: "#111827" },
  { label: "ຂາວ", hex: "#f8fafc" },
];
