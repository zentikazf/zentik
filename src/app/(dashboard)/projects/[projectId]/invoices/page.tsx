'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceDialog } from '@/components/billing/invoice-dialog';
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  Download,
  Pencil,
  DollarSign,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatCurrency } from '@/lib/utils';

const statusConfig: Record<string, { label: string; badgeClass: string; icon: any }> = {
  DRAFT: { label: 'Borrador', badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: FileText },
  SENT: { label: 'Enviada', badgeClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400', icon: Send },
  PAID: { label: 'Pagada', badgeClass: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400', icon: CheckCircle2 },
  OVERDUE: { label: 'Vencida', badgeClass: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400', icon: AlertTriangle },
  CANCELLED: { label: 'Cancelada', badgeClass: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500', icon: AlertTriangle },
};

export default function InvoicesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/invoices`);
      setInvoices(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar facturas';
      toast.error('Error', message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleSend = async (id: string) => {
    try {
      await api.post(`/invoices/${id}/send`);
      toast.success('Factura enviada', 'Se ha enviado al cliente exitosamente');
      loadInvoices();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al enviar factura';
      toast.error('Error', message);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await api.patch(`/invoices/${id}/mark-paid`);
      toast.success('Factura marcada como pagada');
      loadInvoices();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al marcar como pagada';
      toast.error('Error', message);
    }
  };

  const handleDownloadPdf = async (id: string) => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`);
      const url = res.data?.url || res.data;
      if (url && typeof url === 'string') {
        window.open(url, '_blank');
      } else {
        toast.success('PDF generado');
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al generar PDF';
      toast.error('Error', message);
    }
  };

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0);
  const paidAmount = invoices.filter((i) => i.status === 'PAID').reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0);
  const pendingAmount = totalAmount - paidAmount;

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-3 gap-5">
          <Skeleton className="h-24 rounded-[25px]" />
          <Skeleton className="h-24 rounded-[25px]" />
          <Skeleton className="h-24 rounded-[25px]" />
        </div>
        <Skeleton className="h-64 rounded-[25px]" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-end">
        <Button className="rounded-full" onClick={() => { setEditingInvoice(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Generar Factura
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
              <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Facturado</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cobrado</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(paidAmount)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-50 dark:bg-yellow-950">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pendiente</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center rounded-[25px] bg-white py-16 text-center dark:bg-gray-900">
          <FileText className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-400">No hay facturas aún</p>
          <p className="mt-1 text-sm text-gray-400">Genera tu primera factura para este proyecto</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const cfg = statusConfig[inv.status] || statusConfig.DRAFT;
            const StatusIcon = cfg.icon;
            return (
              <div key={inv.id} className="rounded-[25px] bg-white p-5 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <StatusIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-[15px] font-semibold text-gray-800 dark:text-white">{inv.number || inv.identifier || `INV-${inv.id.slice(0, 6)}`}</span>
                      <Badge className={cfg.badgeClass}>{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-[13px] text-gray-400">
                      {inv.periodStart && <span>Periodo: {formatDate(inv.periodStart)} — {formatDate(inv.periodEnd)}</span>}
                      {inv.dueDate && <span>Vence: {formatDate(inv.dueDate)}</span>}
                      {inv.createdAt && <span>Creada: {formatDate(inv.createdAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-gray-800 dark:text-white">{formatCurrency(inv.total || inv.amount || 0)}</span>
                    <div className="flex gap-1">
                      {inv.status === 'DRAFT' && (
                        <>
                          <button onClick={() => { setEditingInvoice(inv); setDialogOpen(true); }} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleSend(inv.id)}>
                            <Send className="mr-1 h-3.5 w-3.5" /> Enviar
                          </Button>
                        </>
                      )}
                      {inv.status === 'SENT' && (
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleMarkPaid(inv.id)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Marcar Pagada
                        </Button>
                      )}
                      <button onClick={() => handleDownloadPdf(inv.id)} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                        <Download className="h-3.5 w-3.5" /> PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InvoiceDialog projectId={projectId} invoice={editingInvoice} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={loadInvoices} />
    </div>
  );
}
