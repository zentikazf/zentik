import { redirect } from 'next/navigation';

/**
 * #68 F5 — El auto-registro salió de la interfaz.
 *
 * El formulario original está íntegro en `page.original.tsx.txt` (mismo directorio). No se borró:
 * la extensión `.txt` lo saca del router de Next sin perder una línea, así que volver atrás es
 * renombrar el archivo.
 *
 * EL ENDPOINT DEL BACKEND SIGUE VIVO. `POST /auth/register` no se tocó — decisión del dueño:
 * queda como puerta de emergencia. Lo que se quita es la puerta pública.
 *
 * POR QUE. `auth.service.ts:68-72` le crea una organización PERSONAL a cada registrado y
 * `organization.service.ts:95-104` lo mete ahí como Owner con `*:*`. Ese es el único modo en que
 * hoy aparece un usuario con DOS memberships — la condición exacta que dispara el bug de permisos
 * que arregló #68 F1b. Sin registro público, el multi-membership sólo puede nacer de una
 * invitación deliberada, que es lo que se quiere.
 *
 * Los usuarios del sistema NO se creaban por acá: los clientes y sus sub-usuarios salen de
 * `client.service.ts` (`createUser:442` / `createSubUser:558`), que arman user + account +
 * organizationMember en su propia transacción y nunca pasan por `authService.register`.
 *
 * POR QUE UN REDIRECT Y NO UN 404: la ruta está linkeada desde afuera (buscadores, historial,
 * links viejos). Un 404 deja a esa persona sin salida; el redirect la deposita en el login, que
 * es lo único que puede hacer.
 */
export default function RegisterPage() {
  redirect('/login');
}
