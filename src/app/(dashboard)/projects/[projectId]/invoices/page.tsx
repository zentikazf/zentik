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
 DRAFT: { label: 'Borrador', badgeClass: 'bg-muted text-muted-foreground', icon: FileText },
 SENT: { label: 'Enviada', badgeClass: 'bg-primary/10 text-primary', icon: Send },
 PAID: { label: 'Pagada', badgeClass: 'bg-success/10 text-success', icon: CheckCircle2 },
 OVERDUE: { label: 'Vencida', badgeClass: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
 CANCELLED: { label: 'Cancelada', badgeClass: 'bg-muted text-muted-foreground', icon: AlertTriangle },
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
 <Skeleton className="h-10 w-48 rounded-xl"/>
 <div className="grid grid-cols-3 gap-5">
 <Skeleton className="h-24 rounded-xl"/>
 <Skeleton className="h-24 rounded-xl"/>
 <Skeleton className="h-24 rounded-xl"/>
 </div>
 <Skeleton className="h-64 rounded-xl"/>
 </div>
 );
 }

 return (
 <div className="space-y-7">
 <div className="flex items-center justify-end">
 <Button className="rounded-full"onClick={() => { setEditingInvoice(null); setDialogOpen(true); }}>
 <Plus className="mr-2 h-4 w-4"/>
 Generar Factura
 </Button>
 </div>

 {/* Stats */}
 <div className="grid gap-5 md:grid-cols-3">
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center gap-3">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
 <DollarSign className="h-6 w-6 text-primary"/>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Facturado</p>
 <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAmount)}</p>
 </div>
 </div>
 </div>
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center gap-3">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
 <CheckCircle2 className="h-6 w-6 text-success"/>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Cobrado</p>
 <p className="text-2xl font-bold text-foreground">{formatCurrency(paidAmount)}</p>
 </div>
 </div>
 </div>
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center gap-3">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
 <Clock className="h-6 w-6 text-warning"/>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Pendiente</p>
 <p className="text-2xl font-bold text-foreground">{formatCurrency(pendingAmount)}</p>
 </div>
 </div>
 </div>
 </div>

 {/* Invoice List */}
 {invoices.length === 0 ? (
 <div className="flex flex-col items-center rounded-xl bg-card py-16 text-center">
 <FileText className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">No hay facturas aún</p>
 <p className="mt-1 text-sm text-muted-foreground">Genera tu primera factura para este proyecto</p>
 </div>
 ) : (
 <div className="space-y-3">
 {invoices.map((inv) => {
 const cfg = statusConfig[inv.status] || statusConfig.DRAFT;
 const StatusIcon = cfg.icon;
 return (
 <div key={inv.id} className="rounded-xl border border-border bg-card p-5">
 <div className="flex items-center justify-between">
 <div className="min-w-0 flex-1 space-y-1">
 <div className="flex items-center gap-3">
 <StatusIcon className="h-4 w-4 text-muted-foreground"/>
 <span className="text-[15px] font-semibold text-foreground">{inv.number || inv.identifier || `INV-${inv.id.slice(0, 6)}`}</span>
 <Badge className={cfg.badgeClass}>{cfg.label}</Badge>
 </div>
 <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
 {inv.periodStart && <span>Periodo: {formatDate(inv.periodStart)} — {formatDate(inv.periodEnd)}</span>}
 {inv.dueDate && <span>Vence: {formatDate(inv.dueDate)}</span>}
 {inv.createdAt && <span>Creada: {formatDate(inv.createdAt)}</span>}
 </div>
 </div>
 <div className="flex items-center gap-4">
 <span className="text-lg font-bold text-foreground">{formatCurrency(inv.total || inv.amount || 0)}</span>
 <div className="flex gap-1">
 {inv.status === 'DRAFT' && (
 <>
 <button onClick={() => { setEditingInvoice(inv); setDialogOpen(true); }} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted">
 <Pencil className="h-3.5 w-3.5"/> Editar
 </button>
 <Button variant="outline"size="sm"className="rounded-full"onClick={() => handleSend(inv.id)}>
 <Send className="mr-1 h-3.5 w-3.5"/> Enviar
 </Button>
 </>
 )}
 {inv.status === 'SENT' && (
 <Button variant="outline"size="sm"className="rounded-full"onClick={() => handleMarkPaid(inv.id)}>
 <CheckCircle2 className="mr-1 h-3.5 w-3.5"/> Marcar Pagada
 </Button>
 )}
 <button onClick={() => handleDownloadPdf(inv.id)} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted">
 <Download className="h-3.5 w-3.5"/> PDF
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
