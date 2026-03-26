'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Upload, FileText, Download, Send, Check, X, Clock, File, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useProject } from '@/providers/project-provider';
import { cn, formatDate } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: FileText },
  PENDING_APPROVAL: { label: 'Pendiente de Aprobación', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400', icon: Clock },
  APPROVED: { label: 'Aprobado', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400', icon: Check },
  REJECTED: { label: 'Rechazado', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', icon: X },
};

function getFileType(file: { originalName?: string; mimeType?: string } | null): 'pdf' | 'image' | 'docx' | 'other' {
  if (!file) return 'other';
  const mime = file.mimeType || '';
  const name = (file.originalName || '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('wordprocessingml') || name.endsWith('.docx') || name.endsWith('.doc')) return 'docx';
  return 'other';
}

export default function AlcancePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, loading, refetch } = useProject();
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [loadingViewer, setLoadingViewer] = useState(false);

  const alcanceStatus = project?.alcanceStatus || 'DRAFT';
  const config = statusConfig[alcanceStatus] || statusConfig.DRAFT;
  const StatusIcon = config.icon;
  const fileType = getFileType(project?.alcanceFile);

  const loadViewerUrl = useCallback(async () => {
    if (!project?.alcanceFileId) return;
    setLoadingViewer(true);
    try {
      const res = await api.get(`/files/${project.alcanceFileId}/download`);
      if (res.data?.url) {
        setViewerUrl(res.data.url);
      }
    } catch {
      toast.error('Error', 'No se pudo cargar la vista previa');
    } finally {
      setLoadingViewer(false);
    }
  }, [project?.alcanceFileId]);

  // Auto-load viewer when file exists
  useEffect(() => {
    if (project?.alcanceFileId && !viewerUrl) {
      loadViewerUrl();
    }
  }, [project?.alcanceFileId, viewerUrl, loadViewerUrl]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('category', 'alcance');

      const res = await api.upload('/files/upload', formData);
      const fileId = res.data?.id;

      if (fileId) {
        await api.patch(`/projects/${projectId}`, {
          alcanceFileId: fileId,
          alcanceStatus: 'DRAFT',
        });
        toast.success('Archivo subido', 'El documento de alcance fue cargado correctamente');
        setViewerUrl(null); // Reset to re-fetch
        await refetch();
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al subir el archivo';
      toast.error('Error', message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [projectId, refetch]);

  const handleSubmitForApproval = useCallback(async () => {
    setSubmitting(true);
    try {
      await api.patch(`/projects/${projectId}`, {
        alcanceStatus: 'PENDING_APPROVAL',
      });
      toast.success('Enviado', 'El alcance fue enviado para aprobación del cliente');
      await refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al enviar';
      toast.error('Error', message);
    } finally {
      setSubmitting(false);
    }
  }, [projectId, refetch]);

  const handleApprove = useCallback(async () => {
    try {
      await api.patch(`/projects/${projectId}`, { alcanceStatus: 'APPROVED' });
      toast.success('Aprobado', 'El alcance ha sido aprobado');
      await refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al aprobar';
      toast.error('Error', message);
    }
  }, [projectId, refetch]);

  const handleReject = useCallback(async () => {
    try {
      await api.patch(`/projects/${projectId}`, { alcanceStatus: 'REJECTED' });
      toast.success('Rechazado', 'El alcance ha sido rechazado');
      await refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al rechazar';
      toast.error('Error', message);
    }
  }, [projectId, refetch]);

  const handleDownload = useCallback(async () => {
    if (viewerUrl) {
      window.open(viewerUrl, '_blank');
      return;
    }
    if (!project?.alcanceFileId) return;
    try {
      const res = await api.get(`/files/${project.alcanceFileId}/download`);
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      }
    } catch {
      toast.error('Error', 'No se pudo descargar el archivo');
    }
  }, [project?.alcanceFileId, viewerUrl]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-[25px]" />
        <Skeleton className="h-64 rounded-[25px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', config.color)}>
              <StatusIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Estado del Alcance</h2>
              <Badge className={cn('mt-1', config.color)}>{config.label}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(alcanceStatus === 'DRAFT' || alcanceStatus === 'REJECTED') && project?.alcanceFileId && (
              <Button
                onClick={handleSubmitForApproval}
                disabled={submitting}
                className="rounded-full"
              >
                <Send className="mr-2 h-4 w-4" />
                {submitting ? 'Enviando...' : 'Enviar para Aprobación'}
              </Button>
            )}

            {alcanceStatus === 'PENDING_APPROVAL' && (
              <>
                <Button onClick={handleApprove} className="rounded-full bg-green-600 hover:bg-green-700">
                  <Check className="mr-2 h-4 w-4" />
                  Aprobar
                </Button>
                <Button onClick={handleReject} variant="outline" className="rounded-full text-red-600 hover:bg-red-50">
                  <X className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Document Section */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Documento de Alcance</h3>
          {project?.alcanceFile && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setShowViewer(!showViewer)}
              >
                {showViewer ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {showViewer ? 'Ocultar' : 'Ver Documento'}
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          )}
        </div>

        {project?.alcanceFile ? (
          <>
            {/* File Info */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                  <File className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{project.alcanceFile.originalName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(project.alcanceFile.size / 1024).toFixed(1)} KB · Subido {formatDate(project.alcanceFile.createdAt)}
                    {fileType === 'pdf' && ' · PDF'}
                    {fileType === 'docx' && ' · Word'}
                    {fileType === 'image' && ' · Imagen'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(alcanceStatus === 'DRAFT' || alcanceStatus === 'REJECTED') && (
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="rounded-full pointer-events-none" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Reemplazar
                      </span>
                    </Button>
                    <input
                      type="file"
                      className="hidden"
                      accept=".doc,.docx,.pdf,.txt,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Document Viewer */}
            {showViewer && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                {loadingViewer ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                      <p className="mt-3 text-sm text-gray-400">Cargando documento...</p>
                    </div>
                  </div>
                ) : viewerUrl ? (
                  <>
                    {fileType === 'pdf' && (
                      <iframe
                        src={viewerUrl}
                        className="h-[700px] w-full border-0"
                        title="Vista previa del alcance"
                      />
                    )}
                    {fileType === 'image' && (
                      <div className="flex items-center justify-center p-6">
                        <img
                          src={viewerUrl}
                          alt="Documento de alcance"
                          className="max-h-[700px] max-w-full rounded-lg object-contain"
                        />
                      </div>
                    )}
                    {fileType === 'docx' && (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <FileText className="mb-3 h-12 w-12 text-blue-400" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Los archivos Word no se pueden previsualizar directamente
                        </p>
                        <p className="mt-1 text-xs text-gray-400">Descarga el archivo para verlo en tu editor</p>
                        <div className="mt-4 flex items-center gap-2">
                          <Button size="sm" className="rounded-full" onClick={handleDownload}>
                            <Download className="mr-2 h-4 w-4" />
                            Descargar Archivo
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => window.open(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewerUrl)}`, '_blank')}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Abrir en Office Online
                          </Button>
                        </div>
                      </div>
                    )}
                    {fileType === 'other' && (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <File className="mb-3 h-12 w-12 text-gray-400" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Vista previa no disponible para este formato
                        </p>
                        <Button size="sm" className="mt-4 rounded-full" onClick={handleDownload}>
                          <Download className="mr-2 h-4 w-4" />
                          Descargar Archivo
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-16">
                    <p className="text-sm text-gray-400">No se pudo cargar la vista previa</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <label className="cursor-pointer">
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-12 transition-colors hover:border-blue-400 hover:bg-blue-50/30 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600">
              <Upload className="mb-3 h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {uploading ? 'Subiendo archivo...' : 'Arrastra o haz clic para subir el documento de alcance'}
              </p>
              <p className="mt-1 text-xs text-gray-400">Word, PDF, imagen o TXT (máx. 10MB)</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".doc,.docx,.pdf,.txt,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {/* Workflow Info */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">Flujo del Alcance</h3>
        <div className="flex items-center gap-3">
          {['Borrador', 'Pendiente', 'Aprobado'].map((step, i) => {
            const isActive =
              (i === 0 && (alcanceStatus === 'DRAFT' || alcanceStatus === 'REJECTED')) ||
              (i === 1 && alcanceStatus === 'PENDING_APPROVAL') ||
              (i === 2 && alcanceStatus === 'APPROVED');
            const isCompleted =
              (i === 0 && alcanceStatus !== 'DRAFT' && alcanceStatus !== 'REJECTED') ||
              (i === 1 && alcanceStatus === 'APPROVED');

            return (
              <div key={step} className="flex items-center gap-3">
                {i > 0 && (
                  <div className={cn('h-0.5 w-8 sm:w-12', isCompleted || isActive ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700')} />
                )}
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                    isActive ? 'bg-blue-600 text-white' :
                    isCompleted ? 'bg-green-600 text-white' :
                    'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                  )}>
                    {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={cn(
                    'text-sm font-medium hidden sm:inline',
                    isActive ? 'text-blue-600 dark:text-blue-400' :
                    isCompleted ? 'text-green-600 dark:text-green-400' :
                    'text-gray-400',
                  )}>
                    {step}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {alcanceStatus === 'REJECTED' && (
          <p className="mt-3 text-sm text-red-500">
            El alcance fue rechazado. Puedes subir una nueva versión y volver a enviarlo.
          </p>
        )}
      </div>
    </div>
  );
}
