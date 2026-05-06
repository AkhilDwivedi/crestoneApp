// Theme tokens for PropFlo CRM (Black + Orange)
export const colors = {
  bg: '#0A0A0A',
  bg2: '#111111',
  surface: '#1A1A1A',
  surfaceAlt: '#222222',
  glass: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  primary: '#FF6B00',
  primaryDark: '#E66000',
  primaryLight: 'rgba(255,107,0,0.15)',
  text: '#FFFFFF',
  textSecondary: '#A3A3A3',
  textMuted: '#737373',
  hot: '#EF4444',
  hotBg: 'rgba(239,68,68,0.15)',
  warm: '#F59E0B',
  warmBg: 'rgba(245,158,11,0.15)',
  cold: '#3B82F6',
  coldBg: 'rgba(59,130,246,0.15)',
  won: '#10B981',
  wonBg: 'rgba(16,185,129,0.15)',
  lost: '#737373',
  lostBg: 'rgba(115,115,115,0.20)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const typography = {
  // System default; we keep weights and sizes consistent
  h1: { fontSize: 30, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 14, color: colors.textSecondary },
  small: { fontSize: 12, color: colors.textMuted },
  overline: { fontSize: 10, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' as const },
};

export function tempColor(t: string) {
  if (t === 'hot') return { fg: colors.hot, bg: colors.hotBg };
  if (t === 'warm') return { fg: colors.warm, bg: colors.warmBg };
  if (t === 'cold') return { fg: colors.cold, bg: colors.coldBg };
  return { fg: colors.textSecondary, bg: colors.glass };
}

export function stageColor(s: string) {
  if (s === 'Closed Won') return { fg: colors.won, bg: colors.wonBg };
  if (s === 'Closed Lost') return { fg: colors.lost, bg: colors.lostBg };
  if (s === 'Negotiation') return { fg: colors.primary, bg: colors.primaryLight };
  if (s === 'Site Visit') return { fg: colors.warm, bg: colors.warmBg };
  if (s === 'Contacted') return { fg: colors.cold, bg: colors.coldBg };
  return { fg: colors.textSecondary, bg: colors.glass };
}

export function formatINR(n?: number | null) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
