'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Upload,
  File as FileIcon,
  Image as ImageIcon,
  FileText,
  Download,
  Trash2,
  Eye,
  EyeOff,
  History,
  MoreVertical,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatRelative, formatDate, cn } from '@/lib/utils';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_OPTIONS,
  DOCUMENT_CATEGORY_COLORS,
  formatFileSize,
} from '@/lib/document-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DocumentItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  projectId?: string | null;
  taskId?: string | null;
  documentCategory?: string | null;
  clientVisible?: boolean;
  version?: number;
  parentFileId?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  uploadedBy?: { id: string; name: string };
  task?: { id: string; title: string } | null;
  downloadEvents?: Array<{
    id: string;
    downloadedAt: string;
    user: { id: string; name: string };
  }>;
  _count?: { downloadEvents: number };
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return ImageIcon;
  if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
  return FileIcon;
}

export default function FilesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [files, setFiles] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [onlyVisible, setOnlyVisible] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>('OTHER');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [versionsModal, setVersionsModal] = useState<{ open: boolean; fileId: string | null; versions: any[] }>({
    open: false,
    fileId: null,
    versions: [],
  });
  const versionUploadRef = useRef<HTMLInputElement>(null);
  const [versionTargetId, setVersionTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/projects/${projectId}/files`);
      setFiles(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await fetch(
        `${API_URL}/api/v1/projects/${projectId}/documents?documentCategory=${uploadCategory}`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || 'Error al subir');
      }
      toast.success('Documento subido', 'Quedó privado. Activá el ojito cuando esté listo para compartir.');
      setUploadOpen(false);
      setUploadFile(null);
      setUploadCategory('OTHER');
      loadFiles();
    } catch (err: any) {
      toast.error('Error', err?.message || 'No se pudo subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const toggleVisibility = async (fileId: string, current: boolean) => {
    try {
      await api.patch(`/documents/${fileId}/visibility`, { clientVisible: !current });
      toast.success(!current ? 'Visible para el cliente' : 'Oculto del cliente');
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, clientVisible: !current } : f)));
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo cambiar visibilidad');
    }
  };

  const handleDelete = async (fileId: string, name: string) => {
    if (!confirm(`¿Eliminar el documento "${name}"? El cliente verá un aviso de "Eliminado".`)) return;
    try {
      await api.delete(`/documents/${fileId}`);
      toast.success('Documento eliminado');
      loadFiles();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo eliminar');
    }
  };

  const handleDownload = (fileId: string) => {
    window.open(`${API_URL}/api/v1/documents/${fileId}/download`, '_blank');
  };

  const openVersionUpload = (fileId: string) => {
    setVersionTargetId(fileId);
    setTimeout(() => versionUploadRef.current?.click(), 0);
  };

  const handleVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !versionTargetId) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/api/v1/documents/${versionTargetId}/versions`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Error al subir versión');
      toast.success('Nueva versión subida');
      setVersionTargetId(null);
      e.target.value = '';
      loadFiles();
    } catch (err: any) {
      toast.error('Error', err?.message || 'No se pudo subir la nueva versión');
    }
  };

  const openVersionsModal = async (fileId: string) => {
    try {
      const res = await api.get<any>(`/documents/${fileId}/versions`);
      setVersionsModal({ open: true, fileId, versions: res.data || [] });
    } catch (err) {
      toast.error('Error', 'No se pudo cargar el historial');
    }
  };

  // Solo documentos directos del proyecto (con projectId), no los heredados de tasks/messages
  const projectDocs = files.filter((f) => !!f.projectId);
  const filtered = projectDocs.filter((f) => {
    if (filterCategory !== 'all' && f.documentCategory !== filterCategory) return false;
    if (onlyVisible && !f.clientVisible) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Compartí archivos con el cliente desde su portal. Privados por default — activá el ojito cuando estén listos.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Subir documento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {DOCUMENT_CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch checked={onlyVisible} onCheckedChange={setOnlyVisible} id="only-visible" />
          <Label htmlFor="only-visible" className="text-sm cursor-pointer">Solo visibles al cliente</Label>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {projectDocs.length === 0 ? 'Subí el primer documento del proyecto' : 'No hay documentos con estos filtros'}
            </p>
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="divide-y">
              {filtered.map((f) => {
                const Icon = getFileIcon(f.mimeType);
                const downloads = f._count?.downloadEvents ?? 0;
                const isDeleted = !!f.deletedAt;
                return (
                  <div key={f.id} className={cn('flex items-center gap-3 p-4', isDeleted && 'opacity-50')}>
                    <Icon className="h-8 w-8 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{f.originalName}</p>
                        {f.documentCategory && (
                          <Badge className={cn('text-[10px]', DOCUMENT_CATEGORY_COLORS[f.documentCategory])}>
                            {DOCUMENT_CATEGORY_LABELS[f.documentCategory]}
                          </Badge>
                        )}
                        {f.version && f.version > 1 && (
                          <Badge variant="outline" className="text-[10px]">v{f.version}</Badge>
                        )}
                        {isDeleted && <Badge variant="destructive" className="text-[10px]">Eliminado</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatFileSize(f.size)} · {f.uploadedBy?.name ?? 'Anon'} · {formatRelative(f.createdAt)}
                      </p>
                      {downloads > 0 && f.downloadEvents && f.downloadEvents.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="mt-1 inline-flex items-center gap-1 cursor-help">
                              <CheckCircle2 className="h-3 w-3 text-success" />
                              <span className="text-[11px] text-success">
                                {downloads === 1
                                  ? `Descargado por ${f.downloadEvents[0].user.name}`
                                  : `Descargado ${downloads} veces`}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1 text-xs">
                              {f.downloadEvents.slice(0, 5).map((ev) => (
                                <div key={ev.id}>
                                  <strong>{ev.user.name}</strong> — {formatDate(ev.downloadedAt)}
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Visibility toggle */}
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => toggleVisibility(f.id, !!f.clientVisible)}
                            disabled={isDeleted}
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                              f.clientVisible
                                ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                                : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
                              isDeleted && 'cursor-not-allowed',
                            )}
                          >
                            {f.clientVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {f.clientVisible ? 'Visible para el cliente' : 'Oculto del cliente — clic para compartir'}
                        </TooltipContent>
                      </Tooltip>

                      <Button variant="ghost" size="sm" onClick={() => handleDownload(f.id)} disabled={isDeleted}>
                        <Download className="h-4 w-4" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={isDeleted}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openVersionUpload(f.id)}>
                            <Upload className="mr-2 h-4 w-4" /> Subir nueva versión
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openVersionsModal(f.id)}>
                            <History className="mr-2 h-4 w-4" /> Ver historial
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(f.id, f.originalName)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Hidden input para subir versiones */}
      <input
        ref={versionUploadRef}
        type="file"
        className="hidden"
        onChange={handleVersionUpload}
      />

      {/* Modal subir documento */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Archivo</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} · {formatFileSize(uploadFile.size)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              El documento se sube como privado. Activá el ojito en la lista cuando esté listo para compartir con el cliente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? 'Subiendo...' : 'Subir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal historial de versiones */}
      <Dialog open={versionsModal.open} onOpenChange={(o) => !o && setVersionsModal({ open: false, fileId: null, versions: [] })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Historial de versiones</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {versionsModal.versions.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin versiones.</p>
            )}
            {versionsModal.versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">v{v.version}</Badge>
                    <span className="text-sm font-medium">{v.originalName}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.uploadedBy?.name} · {formatDate(v.createdAt)} · {formatFileSize(v.size)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDownload(v.id)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
