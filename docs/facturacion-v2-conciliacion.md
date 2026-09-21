# Facturación v2 de Fortaleza

## Reglas confirmadas

Se aplican las mismas reglas de septiembre a todos los meses, incluidos los históricos. La selección representa el **mes de facturación**: fee del mes seleccionado, variables y desarrollo del mes anterior.

| Concepto | Regla comercial USD |
| --- | --- |
| Fee | Cantidad FEE de Botmaker × 299; costo proveedor tomado del mismo mes |
| Agentes | 10 incluidos; excedente × 10 |
| Sesiones | 3.000 incluidas; excedente × 0,11 |
| Líneas WhatsApp | Una incluida; excedente × 100 |
| URL_SCAN | Uso × 0,015, incluso con costo proveedor cero |
| AV_SCAN | Uso × 0,024; confirmado 2.095 unidades en agosto |
| Notificación no recibida | Uso × 0,006 |
| Notificación no respondida | Uso × 0,10 |
| IA y conversaciones WhatsApp | Traspaso exacto del costo real |

Se suman los productos duplicados a nivel cuenta. No se vuelve a sumar el proyecto. WhatsApp se presenta agrupado por categoría para toda Fortaleza, sin asociación por teléfono. El Excel no interviene en la consulta ni en el cálculo. Cada renglón USD se redondea a centavos; IVA 10% por sección. Desarrollo se calcula en PYG y nunca se mezcla con USD.

## Comparación con el HTML de referencia

Archivo: dashboard-onnix-2026-04 (3).html. Aunque se revisaba como facturación de mayo, su DATA declara consumo **2026-04**. Se consultaron abril y mayo en la API real; todos los consumos y costos agregados de Fortaleza en abril coinciden con el HTML.

El HTML aplica otras tarifas. Se conserva como evidencia, sin ejecutar ni incorporar su lógica en producción. Su cálculo real produce USD 2.654,06 con IVA (el PR_GUIDE.md antiguo tiene otro valor).

| Concepto de abril | HTML, USD netos | Reglas confirmadas, USD netos | Diferencia |
| --- | ---: | ---: | ---: |
| Agentes: 30 | 240,00 | 200,00 | -40,00 |
| Sesiones: 12.670 | 628,55 | 1.063,70 | +435,15 |
| Notificaciones no recibidas: 3.178 | 190,68 | 19,07 | -171,61 |
| Notificaciones no respondidas: 7 | 0,07 | 0,70 | +0,63 |
| URL_SCAN: 34 | 0,00 | 0,51 | +0,51 |
| Fee | 299,00 | 299,00 | 0,00 |
| AV_SCAN: 252 | 6,05 | 6,05 | 0,00 |
| IA | 71,21 | 71,21 | 0,00 |
| WhatsApp conversaciones | 877,22 | 877,22 | 0,00 |
| Línea adicional | 100,00 | 100,00 | 0,00 |
| Neto total | 2.412,78 | 2.637,46 | +224,68 |
| Total con IVA | 2.654,06 | 2.901,21 | +247,15 |

La API real y el fixture extraído del HTML producen el mismo cálculo con las nuevas reglas: variables netas USD 2.338,46 + fee neto USD 299,00 = **mayo USD 2.901,21 con IVA**, sin desarrollo.

Para septiembre, la API real entrega variables de agosto netas USD 4.047,92 + IVA USD 404,79 y fee de septiembre USD 299,00 + IVA USD 29,90: **USD 4.781,61** sin desarrollo. AV_SCAN queda en USD 50,28; el Excel tenía una cantidad decimal errónea. Los costos de WhatsApp suman USD 1.230,35, sin usar las tarifas telefónicas redondeadas del Excel.

## Consulta y seguridad

La ruta /api/billing-v2 valida sesión, permiso manage:billing de la organización activa y acceso a la ficha de Fortaleza antes de consultar datos. Usa BOTMAKER_ACCESS_TOKEN privado del servidor Next.js; el navegador nunca recibe el token. Documentación oficial: https://api.botmaker.com/v2.0/ (GET billing/consumptions con billing-period y header access-token).

La consulta lee dos períodos (fee actual y consumo anterior). Valida período, cuenta única, moneda USD y cantidades; conserva consumos de costo cero. No hay fallback a Excel o snapshots. Si Botmaker falla o aparece un producto con costo sin regla, se muestra el error y no se calcula un total incompleto. Cache en memoria del servidor por 15 minutos, máximo 24 meses, con deduplicación de peticiones simultáneas y eliminación de consultas fallidas. Solo retiene la cuenta Fortaleza.

La API responde Cache-Control privado/no-store. El token local se obtuvo de la configuración ya autorizada de Railway y se guardó solo en .env.local (ignorado por Git). Para desplegar esta implementación, configurar la misma variable privada en el frontend; no se modificó producción.

## Desarrollo y switches

Fijo y variables comienzan incluidos; desarrollo, excluido. Las secciones apagadas siguen disponibles para edición interna y no aportan importes o detalles a la vista previa. Los switches se aplican al borrador completo.

Desarrollo permite agregar tareas manuales con fecha del mes de consumo, horas y tarifa PYG por hora; seleccionar en un popup cualquier tarea asociada a proyectos de Fortaleza; editar horas/tarifa; y quitarla del borrador. Las horas estimadas y la tarifa de la tarea o del cliente se usan como sugerencia, pero el usuario confirma los valores antes de agregarla. La selección se pagina de a 50 tareas y no duplica tareas ya agregadas.

Los renglones PYG se redondean a guaraníes enteros y llevan IVA 10%. Al modificar reglas, tareas, secciones o visibilidad aparece el footer fijo **Guardar cambios**. El backend persiste un borrador versionado por cliente y mes, rechaza escrituras concurrentes y registra guardado y publicación en auditoría. **Publicar mes** congela un snapshot comercial y lo deja visible al cliente; el switch permite ocultarlo o volverlo a mostrar mediante un guardado posterior. El portal nunca selecciona el borrador interno, los costos de proveedor, los márgenes ni las reglas.

## Alcance y comprobaciones

Solo se deshabilita el botón anterior en la ficha administrativa de Fortaleza. El portal del cliente y la facturación de otros clientes mantienen su implementación.

Pruebas automatizadas cubren reglas, AV_SCAN, períodos, redondeo, ausencia de Excel, fee del mes correcto, productos gratuitos, costos desconocidos, monedas separadas, permisos, aislamiento por organización/cliente, validación de Botmaker, selección paginada de tareas, versionado, guardado y publicación. La comparación con el HTML tiene un fixture de Fortaleza para regresión. Se verifican también en navegador la consulta, los switches, la selección de tareas, el guardado y la publicación; las consultas a Botmaker se contrastaron por separado con la API real.
