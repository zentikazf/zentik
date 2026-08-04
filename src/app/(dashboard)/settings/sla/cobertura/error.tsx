'use client';

import { SlaRouteError } from '@/components/sla/sla-route-error';

// Error boundary de la ruta. La UI vive en el componente compartido para no
// repetir el mismo bloque en las cinco tabs de /settings/sla.
export default function SlaSegmentError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SlaRouteError {...props} />;
}
