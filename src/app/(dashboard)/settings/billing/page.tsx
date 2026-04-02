'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import { CreditCard, Check, Zap, TrendingDown, X, DollarSign, FileText, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { formatCurrency, formatDate } from '@/lib/utils';

const fallbackPlans = [
 { id: 'FREE', name: 'Free', price: '$0', features: ['3 Proyectos', '5 Miembros', '1 GB Almacenamiento', 'Tableros Kanban'] },
 { id: 'PRO', name: 'Pro', price: '$12', features: ['20 Proyectos', '25 Miembros', '10 GB Almacenamiento', 'Sprints', 'Time Tracking', 'Chat', 'Reportes'] },
 { id: 'ENTERPRISE', name: 'Enterprise', price: '$29', features: ['Proyectos Ilimitados', 'Miembros Ilimitados', '100 GB Almacenamiento', 'Roles Personalizados', 'Registro de Actividad', 'Acceso API', 'Soporte Prioritario'] },
];

export default function BillingSettingsPage() {
 const { orgId } = useOrg();
 const [subscription, setSubscription] = useState<any>(null);
 const [usage, setUsage] = useState<any>(null);
 const [billingSummary, setBillingSummary] = useState<any>(null);
 const [subscriptionInvoices, setSubscriptionInvoices] = useState<any[]>([]);
 const [availablePlans, setAvailablePlans] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [upgrading, setUpgrading] = useState<string | null>(null);
 const [downgradeTarget, setDowngradeTarget] = useState<string | null>(null);
 const [cancelOpen, setCancelOpen] = useState(false);
 const [cancelling, setCancelling] = useState(false);

 useEffect(() => {
 loadBillingData();
 }, [orgId]);

 const loadBillingData = async () => {
 try {
 const results = await Promise.allSettled([
 api.get('/subscriptions/current'),
 api.get('/subscriptions/usage'),
 api.get('/subscriptions/plans'),
 api.get('/subscriptions/invoices'),
 orgId ? api.get(`/organizations/${orgId}/billing/summary`) : Promise.resolve({ data: null }),
 ]);
 if (results[0].status === 'fulfilled') setSubscription(results[0].value.data);
 if (results[1].status === 'fulfilled') setUsage(results[1].value.data);
 if (results[2].status === 'fulfilled') {
 const p = results[2].value.data;
 setAvailablePlans(Array.isArray(p) ? p : p?.data || []);
 }
 if (results[3].status === 'fulfilled') {
 const inv = results[3].value.data;
 setSubscriptionInvoices(Array.isArray(inv) ? inv : inv?.data || []);
 }
 if (results[4].status === 'fulfilled') setBillingSummary(results[4].value.data);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar datos de suscripción';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };

 const currentPlan = subscription?.plan || 'FREE';
 const planOrder = ['FREE', 'PRO', 'ENTERPRISE'];

 const handleChangePlan = async (planId: string) => {
 const currentIdx = planOrder.indexOf(currentPlan);
 const targetIdx = planOrder.indexOf(planId);
 if (targetIdx < currentIdx) { setDowngradeTarget(planId); return; }
 setUpgrading(planId);
 try {
 await api.post('/subscriptions/upgrade', { plan: planId });
 toast.success('Plan actualizado', `Tu plan ha sido cambiado a ${planId}`);
 loadBillingData();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al actualizar el plan';
 toast.error('Error', message);
 } finally { setUpgrading(null); }
 };

 const handleDowngrade = async () => {
 if (!downgradeTarget) return;
 setUpgrading(downgradeTarget);
 try {
 await api.post('/subscriptions/downgrade', { plan: downgradeTarget });
 toast.success('Plan cambiado', `Tu plan ha sido cambiado a ${downgradeTarget}`);
 setDowngradeTarget(null);
 loadBillingData();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cambiar el plan';
 toast.error('Error', message);
 } finally { setUpgrading(null); }
 };

 const handleCancel = async () => {
 setCancelling(true);
 try {
 await api.post('/subscriptions/cancel');
 toast.success('Suscripción cancelada');
 setCancelOpen(false);
 loadBillingData();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cancelar la suscripción';
 toast.error('Error', message);
 } finally { setCancelling(false); }
 };

 const displayPlans = availablePlans.length > 0
 ? availablePlans.map((p: any) => ({
 id: p.id || p.name || p.plan,
 name: p.name || p.plan,
 price: p.price ? `$${p.price}` : fallbackPlans.find((lp) => lp.id === (p.id || p.name))?.price || '$0',
 features: p.features || fallbackPlans.find((lp) => lp.id === (p.id || p.name))?.features || [],
 }))
 : fallbackPlans;

 if (loading) {
 return (
 <div className="space-y-5">
 <Skeleton className="h-32 rounded-xl"/>
 <Skeleton className="h-64 rounded-xl"/>
 </div>
 );
 }

 return (
 <div className="space-y-7">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Facturación y Suscripción</h1>
 <p className="mt-1 text-sm text-muted-foreground">Gestiona tu plan, uso y historial de pagos</p>
 </div>

 {/* Current Plan */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Plan Actual</p>
 <p className="mt-1 text-2xl font-bold text-foreground">{currentPlan}</p>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-success/10 text-success">{subscription?.status || 'ACTIVE'}</Badge>
 {currentPlan !== 'FREE' && (
 <Button variant="ghost"size="sm"className="text-destructive hover:text-destructive"onClick={() => setCancelOpen(true)}>
 Cancelar Suscripción
 </Button>
 )}
 </div>
 </div>
 {usage && (
 <div className="mt-5 grid grid-cols-3 gap-4">
 <div className="rounded-xl bg-primary/10 p-4">
 <p className="text-sm text-muted-foreground">Proyectos</p>
 <p className="mt-1 text-xl font-bold text-foreground">{usage.projects ?? 0}</p>
 </div>
 <div className="rounded-xl bg-info/10 p-4">
 <p className="text-sm text-muted-foreground">Miembros</p>
 <p className="mt-1 text-xl font-bold text-foreground">{usage.members ?? 0}</p>
 </div>
 <div className="rounded-xl bg-success/10 p-4">
 <p className="text-sm text-muted-foreground">Almacenamiento</p>
 <p className="mt-1 text-xl font-bold text-foreground">{usage.storageUsedGB ?? 0} GB</p>
 </div>
 </div>
 )}
 </div>

 {/* Billing Summary */}
 {billingSummary && (
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 text-lg font-semibold text-foreground">Resumen de Facturación</h2>
 <div className="grid gap-4 md:grid-cols-3">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <DollarSign className="h-5 w-5 text-primary"/>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Facturado</p>
 <p className="text-xl font-bold text-foreground">{formatCurrency(billingSummary.totalInvoiced || 0)}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
 <Check className="h-5 w-5 text-success"/>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Cobrado</p>
 <p className="text-xl font-bold text-foreground">{formatCurrency(billingSummary.totalPaid || 0)}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
 <FileText className="h-5 w-5 text-warning"/>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Facturas Pendientes</p>
 <p className="text-xl font-bold text-foreground">{billingSummary.pendingInvoices ?? 0}</p>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Available Plans */}
 <div>
 <h2 className="mb-5 text-lg font-semibold text-foreground">Planes Disponibles</h2>
 <div className="grid gap-5 md:grid-cols-3">
 {displayPlans.map((plan: any) => (
 <div key={plan.id} className={`rounded-xl border border-border bg-card p-6 ${currentPlan === plan.id ? 'ring-2 ring-blue-600' : ''}`}>
 <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
 <p className="mt-1 text-3xl font-bold text-foreground">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mes por usuario</span></p>
 <ul className="mt-5 space-y-2.5">
 {(plan.features || []).map((f: string) => (
 <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-success"/> {f}</li>
 ))}
 </ul>
 <Button
 className="mt-6 w-full rounded-full"
 variant={currentPlan === plan.id ? 'outline' : 'default'}
 disabled={currentPlan === plan.id || upgrading !== null}
 onClick={() => handleChangePlan(plan.id)}
 >
 {currentPlan === plan.id ? 'Plan Actual' : upgrading === plan.id ? 'Cambiando...' : (
 planOrder.indexOf(plan.id) > planOrder.indexOf(currentPlan)
 ? <><Zap className="mr-2 h-4 w-4"/> Mejorar</>
 : <><TrendingDown className="mr-2 h-4 w-4"/> Cambiar</>
 )}
 </Button>
 </div>
 ))}
 </div>
 </div>

 {/* Payment History */}
 {subscriptionInvoices.length > 0 && (
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 text-lg font-semibold text-foreground">Historial de Pagos</h2>
 <div className="space-y-2">
 {subscriptionInvoices.map((inv: any) => (
 <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border p-4">
 <div>
 <p className="text-[15px] font-medium text-foreground">{inv.description || inv.number || 'Pago de suscripción'}</p>
 <p className="mt-0.5 text-[13px] text-muted-foreground">{formatDate(inv.createdAt || inv.date)}</p>
 </div>
 <div className="flex items-center gap-3">
 <span className="font-medium text-foreground">{formatCurrency(inv.amount || inv.total || 0)}</span>
 <Badge className={inv.status === 'PAID' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
 {inv.status === 'PAID' ? 'Pagado' : inv.status || 'Pendiente'}
 </Badge>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Downgrade Dialog */}
 <Dialog open={!!downgradeTarget} onOpenChange={() => setDowngradeTarget(null)}>
 <DialogContent>
 <DialogHeader><DialogTitle>Confirmar Cambio de Plan</DialogTitle></DialogHeader>
 <div className="flex items-center gap-3 py-4">
 <AlertTriangle className="h-8 w-8 text-warning"/>
 <p className="text-sm">Al cambiar a un plan inferior podrías perder acceso a algunas funcionalidades. ¿Estás seguro que deseas cambiar a <strong>{downgradeTarget}</strong>?</p>
 </div>
 <DialogFooter>
 <Button variant="outline"onClick={() => setDowngradeTarget(null)}>Cancelar</Button>
 <Button variant="destructive"onClick={handleDowngrade} disabled={upgrading !== null}>{upgrading ? 'Cambiando...' : 'Sí, cambiar plan'}</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Cancel Dialog */}
 <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
 <DialogContent>
 <DialogHeader><DialogTitle>Cancelar Suscripción</DialogTitle></DialogHeader>
 <div className="flex items-center gap-3 py-4">
 <X className="h-8 w-8 text-destructive"/>
 <p className="text-sm">Al cancelar tu suscripción perderás acceso a todas las funciones premium al final del periodo de facturación actual. ¿Estás seguro?</p>
 </div>
 <DialogFooter>
 <Button variant="outline"onClick={() => setCancelOpen(false)}>No, mantener plan</Button>
 <Button variant="destructive"onClick={handleCancel} disabled={cancelling}>{cancelling ? 'Cancelando...' : 'Sí, cancelar suscripción'}</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
