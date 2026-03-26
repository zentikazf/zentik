'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { formatDuration } from '@/lib/utils';

const orgReportTypes = [
  { value: 'overview', label: 'Resumen General' },
  { value: 'tasks', label: 'Reporte de Tareas' },
  { value: 'time', label: 'Reporte de Tiempo' },
  { value: 'team', label: 'Rendimiento del Equipo' },
  { value: 'productivity', label: 'Productividad' },
  { value: 'profitability', label: 'Rentabilidad' },
];

export default function ReportsPage() {
  const { orgId } = useOrg();
  const [reportType, setReportType] = useState('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [personalData, setPersonalData] = useState<any>(null);
  const [timeReport, setTimeReport] = useState<any>(null);

  useEffect(() => {
    if (orgId) loadReport();
  }, [reportType, orgId]);

  useEffect(() => {
    loadPersonalSummary();
    loadTimeReport();
  }, []);

  const loadReport = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString() ? `?${params}` : '';
      const res = await api.get(`/organizations/${orgId}/reports/${reportType}${qs}`);
      setData(res.data);
    } catch (err) {
      setData(null);
      if (err instanceof ApiError) toast.error('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPersonalSummary = async () => {
    try {
      const res = await api.get('/users/me/reports/summary');
      setPersonalData(res.data);
    } catch {}
  };

  const loadTimeReport = async () => {
    try {
      const res = await api.get('/users/me/time-report');
      setTimeReport(res.data);
    } catch {}
  };

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Reportes</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Análisis y métricas de tu organización</p>
      </div>

      {/* Personal Summary */}
      {personalData && (
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white">Mi Resumen Personal</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950">
              <p className="text-sm text-gray-500 dark:text-gray-400">Tareas completadas</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{personalData.tasksCompleted ?? 0}</p>
            </div>
            <div className="rounded-xl bg-yellow-50 p-4 dark:bg-yellow-950">
              <p className="text-sm text-gray-500 dark:text-gray-400">En progreso</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{personalData.tasksInProgress ?? 0}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-4 dark:bg-green-950">
              <p className="text-sm text-gray-500 dark:text-gray-400">Tiempo registrado</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{formatDuration(personalData.totalTimeLogged ?? 0)}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 dark:bg-purple-950">
              <p className="text-sm text-gray-500 dark:text-gray-400">Productividad</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{personalData.productivityScore ?? personalData.completionRate ?? 0}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Personal Time Report */}
      {timeReport && (
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white">Mi Reporte de Tiempo</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total registrado</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{formatDuration(timeReport.totalMinutes ?? (timeReport.totalHours ? timeReport.totalHours * 60 : 0))}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-4 dark:bg-green-950">
              <p className="text-sm text-gray-500 dark:text-gray-400">Horas facturables</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{formatDuration(timeReport.billableMinutes ?? (timeReport.billableHours ? timeReport.billableHours * 60 : 0))}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Entradas</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{timeReport.totalEntries ?? timeReport.entries?.length ?? 0}</p>
            </div>
          </div>
          {timeReport.byProject && Array.isArray(timeReport.byProject) && timeReport.byProject.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-medium text-gray-400">Por proyecto</p>
              {timeReport.byProject.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-800">
                  <span className="text-gray-800 dark:text-white">{p.projectName || p.name}</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{formatDuration(p.minutes ?? (p.hours ? p.hours * 60 : 0))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-[25px] bg-white p-5 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-56">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {orgReportTypes.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Desde</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Hasta</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" size="sm" onClick={loadReport} className="rounded-full">Aplicar</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[25px]" />)}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {data.tasksCompleted !== undefined && (
              <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tareas Completadas</p>
                    <p className="mt-1 text-3xl font-bold text-gray-800 dark:text-white">{data.tasksCompleted}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
            )}
            {data.tasksInProgress !== undefined && (
              <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">En Progreso</p>
                    <p className="mt-1 text-3xl font-bold text-gray-800 dark:text-white">{data.tasksInProgress}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                    <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
            )}
            {data.totalTimeLogged !== undefined && (
              <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tiempo Registrado</p>
                    <p className="mt-1 text-3xl font-bold text-gray-800 dark:text-white">{formatDuration(data.totalTimeLogged)}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-50 dark:bg-yellow-950">
                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </div>
            )}
            {data.completionRate !== undefined && (
              <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tasa de Completado</p>
                    <p className="mt-1 text-3xl font-bold text-gray-800 dark:text-white">{data.completionRate}%</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950">
                    <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </div>
            )}
            {data.totalRevenue !== undefined && (
              <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ingresos Totales</p>
                    <p className="mt-1 text-3xl font-bold text-gray-800 dark:text-white">${data.totalRevenue}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {data.members && Array.isArray(data.members) && data.members.length > 0 && (
            <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
              <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white">Por Miembro</h2>
              <div className="space-y-3">
                {data.members.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                    <span className="font-medium text-gray-800 dark:text-white">{m.name || m.userName || `Miembro ${i + 1}`}</span>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {m.tasksCompleted !== undefined && <span>{m.tasksCompleted} completadas</span>}
                      {m.timeLogged !== undefined && <span>{formatDuration(m.timeLogged)}</span>}
                      {m.score !== undefined && <span className="font-bold text-blue-600 dark:text-blue-400">{m.score}%</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.projects && Array.isArray(data.projects) && data.projects.length > 0 && (
            <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
              <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white">Por Proyecto</h2>
              <div className="space-y-3">
                {data.projects.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                    <span className="font-medium text-gray-800 dark:text-white">{p.name || `Proyecto ${i + 1}`}</span>
                    <div className="flex items-center gap-4 text-sm">
                      {p.revenue !== undefined && <span className="text-green-600 dark:text-green-400">${p.revenue}</span>}
                      {p.cost !== undefined && <span className="text-red-500 dark:text-red-400">-${p.cost}</span>}
                      {p.profit !== undefined && <span className="font-bold text-gray-800 dark:text-white">${p.profit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center rounded-[25px] bg-white py-16 text-center dark:bg-gray-900">
          <BarChart3 className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-400">No hay datos disponibles para este reporte</p>
        </div>
      )}
    </div>
  );
}
