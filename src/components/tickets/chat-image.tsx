'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff } from 'lucide-react';
import { getToken } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ChatImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Renderiza una imagen adjunta del chat inline (con lightbox al click).
 *
 * El endpoint que sirve los bytes (`/files/:id/raw`) exige sesion para los
 * ATTACHMENT, pero un <img src> no manda el header Authorization y las cookies
 * cross-domain (frontend Vercel ↔ backend Railway) se bloquean por third-party
 * cookies (ver api-client.ts). Por eso, cuando la URL apunta a NUESTRO backend,
 * bajamos la imagen via fetch autenticado (Bearer) -> blob -> object URL. Cuando
 * es una URL firmada externa (S3/Supabase presigned) se usa directa como <img>
 * (self-authorizing; fetch-a-blob cross-origin fallaria por CORS).
 */
export function ChatImage({ src, alt, className }: ChatImageProps) {
  const isBackendUrl = src.startsWith(API_URL);
  const [blobUrl, setBlobUrl] = useState<string | null>(isBackendUrl ? null : src);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  // Descarga autenticada solo para URLs de nuestro backend; las presigned se
  // usan directas. Revoca el object URL al desmontar / cambiar de src.
  useEffect(() => {
    if (!isBackendUrl) {
      setBlobUrl(src);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setError(false);
    setBlobUrl(null);
    const token = getToken();
    fetch(src, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, isBackendUrl]);

  // Cierre del lightbox con Escape.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground',
          className,
        )}
      >
        <ImageOff className="h-4 w-4 shrink-0" />
        <span className="truncate">{alt}</span>
      </div>
    );
  }

  if (!blobUrl) {
    return <div className={cn('h-32 w-32 animate-pulse rounded-lg bg-muted', className)} />;
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={blobUrl}
        alt={alt}
        loading="lazy"
        onClick={() => setLightbox(true)}
        className={cn(
          'cursor-zoom-in rounded-lg border border-border object-cover transition-opacity hover:opacity-90',
          className,
        )}
      />
      {lightbox &&
        createPortal(
          <div
            onClick={() => setLightbox(false)}
            className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={blobUrl}
              alt={alt}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
