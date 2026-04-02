'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

export default function JoinOrgPage() {
 const { code } = useParams<{ code: string }>();
 const router = useRouter();
 const [joining, setJoining] = useState(false);
 const [joined, setJoined] = useState(false);

 const handleJoin = async () => {
 setJoining(true);
 try {
 await api.post(`/organizations/join/${code}`);
 setJoined(true);
 toast.success('Te has unido a la organización');
 setTimeout(() => {
 window.location.href = '/dashboard';
 }, 1500);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'No se pudo unir a la organización';
 toast.error('Error', message);
 } finally {
 setJoining(false);
 }
 };

 if (joined) {
 return (
 <div className="flex min-h-[60vh] items-center justify-center">
 <Card className="max-w-md p-8 text-center">
 <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success"/>
 <h2 className="text-xl font-bold">¡Bienvenido!</h2>
 <p className="mt-2 text-sm text-muted-foreground">Te has unido exitosamente. Redirigiendo...</p>
 </Card>
 </div>
 );
 }

 return (
 <div className="flex min-h-[60vh] items-center justify-center">
 <Card className="max-w-md p-8 text-center">
 <Users className="mx-auto mb-4 h-12 w-12 text-primary"/>
 <h2 className="text-xl font-bold">Invitación a una Organización</h2>
 <p className="mt-2 text-sm text-muted-foreground">
 Has recibido una invitación para unirte a una organización en Zentik.
 </p>
 <p className="mt-1 text-xs text-muted-foreground">
 Código: <code className="rounded bg-muted px-1">{code}</code>
 </p>
 <Button className="mt-6 w-full"onClick={handleJoin} disabled={joining}>
 {joining ? 'Uniéndose...' : 'Unirse a la Organización'}
 </Button>
 <Button variant="ghost"className="mt-2 w-full"onClick={() => router.push('/dashboard')}>
 Cancelar
 </Button>
 </Card>
 </div>
 );
}
