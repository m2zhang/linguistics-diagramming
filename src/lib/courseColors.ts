export const COURSE_COLOR_KEYS = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
] as const;

export type CourseColorKey = (typeof COURSE_COLOR_KEYS)[number];

/** Mid-saturation hues chosen to read clearly as a small dot/bar on both a
 *  near-white and a near-black card background — this app's dark theme is
 *  closer to true black than most Tailwind dark palettes assume. */
const HEX: Record<CourseColorKey, string> = {
  red: '#f87171',
  orange: '#fb923c',
  amber: '#fbbf24',
  green: '#4ade80',
  teal: '#2dd4bf',
  blue: '#60a5fa',
  indigo: '#818cf8',
  purple: '#c084fc',
  pink: '#f472b6',
};

export function courseColorHex(key: string | null | undefined): string {
  return HEX[key as CourseColorKey] ?? HEX.blue;
}
