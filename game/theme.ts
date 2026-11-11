// Read 2.0 design tokens (defined once in theme.css) for code that needs raw colors, such as three.js scenes.

export type ThemeToken =
  | 'ground-deepest'
  | 'ground'
  | 'ground-raised'
  | 'ground-high'
  | 'line'
  | 'line-strong'
  | 'ink'
  | 'ink-soft'
  | 'ink-muted'
  | 'gold'
  | 'rune';

export const themeColor = (token: ThemeToken): string =>
  getComputedStyle(document.documentElement).getPropertyValue(`--tm-${token}`).trim();
