import { redirect } from 'next/navigation';

// `/settings/sla` ya no tiene contenido propio: es el índice de las tabs.
// Se entra por la primera (políticas). Los links viejos a /settings/sla siguen
// funcionando gracias a este redirect.
export default function SlaSettingsIndexPage() {
  redirect('/settings/sla/politicas');
}
