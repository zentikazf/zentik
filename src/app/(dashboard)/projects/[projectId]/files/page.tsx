'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, File, Image, FileText, Download, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatRelative } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  const loadFiles = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/files`);
      setFiles(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar archivos';
      toast.error('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);

      const res = await fetch(`${API_URL}/api/v1/files/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Error al subir archivo');
      }

      toast.success('Archivo subido', file.name);
      loadFiles();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al subir archivo';
      toast.error('Error', message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await api.delete(`/files/${fileId}`);
      setFiles(files.filter((f) => f.id !== fileId));
      toast.success('Archivo eliminado');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar archivo';
      toast.error('Error', message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[25px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Archivos</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Gestiona los archivos del proyecto</p>
        </div>
        <div>
          <input type="file" id="file-upload" className="hidden" onChange={handleUpload} />
          <Button asChild disabled={uploading} className="rounded-full">
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" /> {uploading ? 'Subiendo...' : 'Subir Archivo'}
            </label>
          </Button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center rounded-[25px] bg-white py-16 text-center dark:bg-gray-900">
          <File className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-400">No hay archivos subidos aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => {
            const Icon = getFileIcon(file.mimeType);
            return (
              <div key={file.id} className="flex items-center gap-4 rounded-[25px] bg-white p-5 dark:bg-gray-900">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                  <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-gray-800 dark:text-white">{file.name}</p>
                  <p className="text-[13px] text-gray-400">
                    {formatFileSize(file.size)} · Subido {formatRelative(file.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={async () => {
                      try {
                        const res = await api.get(`/files/${file.id}/download`);
                        const url = res.data?.url || res.data;
                        if (url && typeof url === 'string') window.open(url, '_blank');
                      } catch {
                        if (file.url) window.open(file.url, '_blank');
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
