'use client';

import { Toaster } from 'sileo';
import { useTheme } from 'next-themes';

/**
 * H6 / AJ-5 — Toaster sincronizado con el tema.
 *
 * Bug: en modo oscuro el texto (description) del toast era invisible. Causa raíz:
 * el `<Toaster/>` de sileo se montaba SIN la prop `theme`, así que sileo no ponía el
 * atributo `data-theme` en su viewport. Sin `data-theme`, la card cae a su `fill` por
 * defecto (#FFFFFF, blanca) y la description no matchea ninguna regla de color → hereda
 * `currentColor` (= `--foreground`, casi blanco en dark) → blanco sobre blanco.
 *
 * Fix: pasarle el tema real de la app (next-themes `resolvedTheme`). sileo diseña un toast
 * de CONTRASTE (theme "dark" → card clara #f2f2f2 + texto oscuro; theme "light" → card
 * oscura #1a1a1a + texto claro), así que pasar el tema resuelto deja el texto legible en
 * ambos modos. Se resuelve en cliente (useTheme) — por eso este wrapper 'use client'.
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />;
}
