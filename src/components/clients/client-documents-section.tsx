'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  MoreVertical,
  Plus,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { formatRelative, cn } from '@/lib/utils';
import { formatFileSize, isUpdated } from '@/lib/document-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ClientDocumentItem {
  id: string;
  name: string;
  description?: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  clientVisible?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: string; name: string };
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return ImageIcon;
  if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
  return FileIcon;
}

interface Props {
  clientId: string;
  clientName: string;
}

export function ClientDocumentsSection({ clientId, clientName }: Props) {
  const { orgId } = useOrg();
  const [files, setFiles] = useState<ClientDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyVisible, setOnlyVisible] = useState(false);

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<ClientDocumentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clientId) loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/clients/${clientId}/documents`);
      const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setFiles(list);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setFiles([]);
      } else {
        toast.error('Error', err instanceof ApiError ? err.message : 'Error al cargar documentos');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetUpload = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadVisible(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!uploadFile || !orgId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const params = new URLSearchParams();
      if (uploadTitle.trim()) params.set('title', uploadTitle.trim());
      if (uploadDescription.trim()) params.set('description', uploadDescription.trim());
      if (uploadVisible) params.set('clientVisible', 'true');
      const qs = params.toString() ? `?${params}` : '';

      const res = await fetch(
        `${API_URL}/api/v1/clients/${clientId}/documents${qs}`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || data?.message || 'Error al subir');
      }
      toast.success(
        'Documento subido',
        uploadVisible ? 'Compartido con el cliente' : 'Quedó privado. Activá el ojito para compartir.',
      );
      setUploadOpen(false);
      resetUpload();
      loadFiles();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo subir el documento');
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
    if (!confirm(`¿Eliminar el documento "${name}"?`)) return;
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

  const openEdit = (doc: ClientDocumentItem) => {
    setEditTarget(doc);
    setEditTitle(doc.name);
    setEditDescription(doc.description ?? '');
    setEditFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditTitle('');
    setEditDescription('');
    setEditFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const handleEditSubmit = async () => {
    if (!editTarget) return;
    setEditing(true);
    try {
      const formData = new FormData();
      if (editFile) formData.append('file', editFile);
      if (editTitle.trim()) formData.append('name', editTitle.trim());
      formData.append('description', editDescription.trim());

      const res = await fetch(`${API_URL}/api/v1/documents/${editTarget.id}/edit`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || data?.message || 'Error al editar');
      }
      toast.success('Documento actualizado');
      closeEdit();
      loadFiles();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo editar');
    } finally {
      setEditing(false);
    }
  };

  const filtered = files.filter((f) => {
    if (onlyVisible && !f.clientVisible) return false;
    return true;
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-card-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Documentos del Cliente
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contratos, NDAs, documentación general — independientes de los proyectos.
          </p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="mr-1 h-3 w-3" /> Subir documento
        </Button>
      </div>

      {/* Filtro */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <Switch checked={onlyVisible} onCheckedChange={setOnlyVisible} id="client-only-visible" />
          <Label htmlFor="client-only-visible" className="text-xs cursor-pointer text-muted-foreground">
            Solo visibles al cliente
          </Label>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center">
          <FileIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {files.length === 0
              ? 'Subí el primer documento del cliente'
              : 'No hay documentos visibles para el cliente'}
          </p>
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="divide-y divide-border rounded-lg border border-border">
            {filtered.map((f) => {
              const Icon = getFileIcon(f.mimeType);
              const isDeleted = !!f.deletedAt;
              const updated = isUpdated(f.createdAt, f.updatedAt);
              return (
                <div
                  key={f.id}
                  className={cn('flex items-center gap-3 p-3', isDeleted && 'opacity-50')}
                >
                  <Icon className="h-7 w-7 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                      {updated && !isDeleted && (
                        <Badge className="bg-info/10 text-info border-transparent text-[10px]">Actualizado</Badge>
                      )}
                      {isDeleted && <Badge variant="destructive" className="text-[10px]">Eliminado</Badge>}
                    </div>
                    {f.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{f.description}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {formatFileSize(f.size)} · {f.uploadedBy?.name ?? 'Anon'} · {formatRelative(f.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => toggleVisibility(f.id, !!f.clientVisible)}
                          disabled={isDeleted}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                            f.clientVisible
                              ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                              : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
                            isDeleted && 'cursor-not-allowed',
                          )}
                        >
                          {f.clientVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {f.clientVisible ? 'Visible para el cliente' : 'Oculto del cliente — clic para compartir'}
                      </TooltipContent>
                    </Tooltip>

                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownload(f.id)} disabled={isDeleted}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={isDeleted}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(f)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(f.id, f.name)}
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

      {/* Modal subir */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) resetUpload(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir documento del cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Documento general para <strong>{clientName}</strong> — independiente de los proyectos.
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Archivo *</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setUploadFile(f);
                  if (f && !uploadTitle.trim()) setUploadTitle(f.name);
                }}
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} · {formatFileSize(uploadFile.size)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Nombre visible del documento"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Subtítulo o nota corta sobre el documento..."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
              <Switch checked={uploadVisible} onCheckedChange={setUploadVisible} id="upload-visible" />
              <Label htmlFor="upload-visible" className="text-sm cursor-pointer">
                Compartir con el cliente al subir
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetUpload(); }}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? 'Subiendo...' : 'Subir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Reemplazar archivo (opcional)</Label>
                <Input
                  ref={editFileInputRef}
                  type="file"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Actual: {editTarget.originalName} · {formatFileSize(editTarget.size)}.
                  Si subís un nuevo archivo, reemplaza al actual.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Nombre visible"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Subtítulo o nota corta..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={editing}>Cancelar</Button>
            <Button onClick={handleEditSubmit} disabled={editing}>
              {editing ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
