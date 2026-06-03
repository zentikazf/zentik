'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'members-collapsed-sections';

/**
 * Persiste en localStorage los ids de las secciones colapsadas en la vista
 * de miembros. Por default, todas las secciones de cliente arrancan colapsadas
 * (la seccion "team" arranca expandida).
 */
export function useCollapsedSections(initialCollapsedIds: string[] = []) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(initialCollapsedIds);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set(initialCollapsedIds);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set(initialCollapsedIds);
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    } catch {
      return new Set(initialCollapsedIds);
    }
  });

  /** Limpia ids del Set que ya no existen entre los grupos vigentes */
  const reconcile = useCallback((validIds: string[]) => {
    setCollapsed((prev) => {
      const valid = new Set(validIds);
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      if (next.size === prev.size) return prev;
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore quota / disabled localStorage
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (id: string) => collapsed.has(id),
    [collapsed],
  );

  // Persistencia diferida: si el set cambia por reconcile, sincronizamos.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(collapsed)));
    } catch {
      // ignore
    }
  }, [collapsed]);

  return { collapsed, toggle, isCollapsed, reconcile };
}
