'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Download,
  AlertCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatRelative } from '@/lib/utils';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_COLORS,
  formatFileSize,
} from '@/lib/document-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ClientDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  category: string | null;
  version: number;
  uploadedAt: string;
  uploadedByName: string | null;
  deleted: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return ImageIcon;
  if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
  return FileIcon;
}

export default function PortalDocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ClientDocument[]>(`/portal/projects/${projectId}/documents`)
      .then((res) => setDocs(res.data || []))
      .catch((err) => toast.error('Error', err instanceof ApiError ? err.message : 'No se pudieron cargar los documentos'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDownload = (id: string, deleted: boolean) => {
    if (deleted) return;
    window.open(`${API_URL}/api/v1/portal/documents/${id}/download`, '_blank');
  };

  // Agrupar por categoría
  const grouped: Record<string, ClientDocument[]> = {};
  docs.forEach((d) => {
    const key = d.category || 'OTHER';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <FileIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h2 className="mt-4 text-lg font-medium">Aún no hay documentos compartidos</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cuando el equipo te comparta un documento del proyecto, aparecerá acá.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Documentos compartidos por el equipo en este proyecto.
        </p>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category}>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            {DOCUMENT_CATEGORY_LABELS[category] || 'Otro'}
          </h3>
          <div className="rounded-xl border bg-card divide-y">
            {items.map((d) => {
              const Icon = getFileIcon(d.mimeType);
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 p-4 ${d.deleted ? 'opacity-60' : ''}`}
                >
                  <Icon className="h-8 w-8 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                      {d.version > 1 && (
                        <Badge variant="outline" className="text-[10px]">v{d.version}</Badge>
                      )}
                      {d.deleted && (
                        <Badge className="bg-muted text-muted-foreground text-[10px]">
                          <AlertCircle className="mr-1 h-3 w-3" /> Eliminado por el equipo
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatFileSize(d.size)} · {d.uploadedByName ?? 'Equipo'} · {formatRelative(d.uploadedAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(d.id, d.deleted)}
                    disabled={d.deleted}
                  >
                    <Download className="mr-2 h-4 w-4" /> Descargar
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
