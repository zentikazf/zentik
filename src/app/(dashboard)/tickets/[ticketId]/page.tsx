import { redirect } from 'next/navigation';

interface PageProps {
  params: { ticketId: string };
}

/**
 * Backward compatibility: la página dedicada de detalle de ticket
 * fue reemplazada por el panel lateral en /tickets.
 * Cualquier link viejo se redirige preservando el ticketId.
 */
export default function TicketDetailRedirect({ params }: PageProps) {
  redirect(`/tickets?ticket=${params.ticketId}&panel=open`);
}
