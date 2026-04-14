'use client';

import { useState } from 'react';
import {
 LayoutDashboard,
 FolderKanban,
 Ticket,
 Bell,
 ChevronLeft,
 ChevronRight,
 Clock,
 MessageSquare,
 Upload,
 Settings,
 ArrowRight,
 CheckCircle2,
 AlertTriangle,
 Info,
 BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  DATA — Contenido hardcoded del manual                             */
/* ------------------------------------------------------------------ */

interface Section {
 id: string;
 title: string;
 content: React.ReactNode;
}

interface Module {
 id: string;
 title: string;
 description: string;
 icon: React.ElementType;
 color: string;
 sections: Section[];
}

const modules: Module[] = [
 {
  id: 'dashboard',
  title: 'Panel de Control',
  description: 'Vista general de tus proyectos, horas y actividad.',
  icon: LayoutDashboard,
  color: 'bg-primary/10 text-primary',
  sections: [
   {
    id: 'dashboard-intro',
    title: 'Introduccion',
    content: (
     <div className="space-y-4">
      <p>El <strong>Panel de Control</strong> es la primera pantalla que ves al iniciar sesion. Resume el estado actual de todos tus servicios en un solo lugar.</p>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Que vas a encontrar:</h4>
       <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Tarjetas KPI con metricas clave</li>
        <li>Alertas de consumo de horas</li>
        <li>Accesos rapidos a las secciones principales</li>
       </ul>
      </div>
     </div>
    ),
   },
   {
    id: 'dashboard-kpis',
    title: 'Tarjetas KPI',
    content: (
     <div className="space-y-4">
      <p>En la parte superior encontraras <strong>4 tarjetas</strong> con informacion clave:</p>
      <div className="grid gap-3 sm:grid-cols-2">
       <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-1">
         <FolderKanban className="h-4 w-4 text-primary"/>
         <span className="font-semibold text-sm">Proyectos Activos</span>
        </div>
        <p className="text-xs text-muted-foreground">Cantidad total de proyectos en curso asignados a tu cuenta.</p>
       </div>
       <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-1">
         <CheckCircle2 className="h-4 w-4 text-primary"/>
         <span className="font-semibold text-sm">Progreso General</span>
        </div>
        <p className="text-xs text-muted-foreground">Porcentaje de avance calculado sobre las tareas completadas vs totales.</p>
       </div>
       <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-1">
         <CheckCircle2 className="h-4 w-4 text-primary"/>
         <span className="font-semibold text-sm">Tareas Listas</span>
        </div>
        <p className="text-xs text-muted-foreground">Numero de tareas finalizadas del total de tareas visibles.</p>
       </div>
       <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-1">
         <Clock className="h-4 w-4 text-primary"/>
         <span className="font-semibold text-sm">Horas Disponibles</span>
        </div>
        <p className="text-xs text-muted-foreground">Horas restantes de tu plan contratado. Se actualiza en tiempo real.</p>
       </div>
      </div>
     </div>
    ),
   },
   {
    id: 'dashboard-hours',
    title: 'Alertas de horas',
    content: (
     <div className="space-y-4">
      <p>El sistema muestra alertas automaticas segun tu <strong>consumo de horas</strong>:</p>
      <div className="space-y-2">
       <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/10 p-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5"/>
        <div>
         <p className="text-sm font-medium text-primary">50% de consumo</p>
         <p className="text-xs text-muted-foreground">Informativo. Todo en orden, pero ya usaste la mitad de tus horas.</p>
        </div>
       </div>
       <div className="flex items-start gap-3 rounded-lg bg-warning/10 border border-warning/20 p-3">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5"/>
        <div>
         <p className="text-sm font-medium text-warning">75% de consumo</p>
         <p className="text-xs text-muted-foreground">Consumo elevado. Recomendamos planificar el uso restante.</p>
        </div>
       </div>
       <div className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5"/>
        <div>
         <p className="text-sm font-medium text-destructive">90% o mas</p>
         <p className="text-xs text-muted-foreground">Quedan pocas horas. Coordina con tu equipo para adquirir mas.</p>
        </div>
       </div>
      </div>
     </div>
    ),
   },
   {
    id: 'dashboard-actions',
    title: 'Acciones rapidas',
    content: (
     <div className="space-y-4">
      <p>Debajo de las tarjetas KPI encontraras <strong>3 accesos directos</strong>:</p>
      <ul className="space-y-2">
       <li className="flex items-center gap-2 text-sm">
        <ArrowRight className="h-3.5 w-3.5 text-primary"/>
        <strong>Mis Proyectos</strong> — Ir directamente a la lista de proyectos y ver progreso.
       </li>
       <li className="flex items-center gap-2 text-sm">
        <ArrowRight className="h-3.5 w-3.5 text-primary"/>
        <strong>Tickets</strong> — Ver tus tickets abiertos o crear uno nuevo.
       </li>
       <li className="flex items-center gap-2 text-sm">
        <ArrowRight className="h-3.5 w-3.5 text-primary"/>
        <strong>Notificaciones</strong> — Revisar alertas y actualizaciones recientes.
       </li>
      </ul>
     </div>
    ),
   },
  ],
 },
 {
  id: 'projects',
  title: 'Proyectos',
  description: 'Seguimiento de avance, tareas y entregas de tus proyectos.',
  icon: FolderKanban,
  color: 'bg-violet-500/10 text-violet-500',
  sections: [
   {
    id: 'projects-intro',
    title: 'Introduccion',
    content: (
     <div className="space-y-4">
      <p>La seccion de <strong>Proyectos</strong> te permite ver todos los proyectos activos asignados a tu cuenta, con su avance en tiempo real.</p>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Objetivo:</h4>
       <p className="text-sm text-muted-foreground">Que puedas consultar en cualquier momento el estado de tus proyectos sin necesidad de contactar al equipo.</p>
      </div>
     </div>
    ),
   },
   {
    id: 'projects-list',
    title: 'Lista de proyectos',
    content: (
     <div className="space-y-4">
      <p>Al ingresar veras una lista de <strong>tarjetas</strong> — una por cada proyecto activo.</p>
      <p className="text-sm">Cada tarjeta muestra:</p>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
       <li><strong>Nombre del proyecto</strong></li>
       <li><strong>Barra de progreso</strong> — porcentaje de tareas completadas</li>
       <li><strong>Tareas visibles</strong> — cantidad completadas vs totales</li>
       <li><strong>Fecha de inicio y fin</strong> estimadas del proyecto</li>
      </ul>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Nota:</h4>
       <p className="text-xs text-muted-foreground">Solo se muestran proyectos con estado <strong>Activo</strong>. Los proyectos archivados o deshabilitados no aparecen en esta vista.</p>
      </div>
     </div>
    ),
   },
   {
    id: 'projects-detail',
    title: 'Detalle del proyecto',
    content: (
     <div className="space-y-4">
      <p>Al hacer clic en un proyecto accedes al <strong>detalle</strong>, donde puedes ver:</p>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
       <li><strong>Descripcion</strong> del proyecto</li>
       <li><strong>Lista de tareas</strong> con su estado actual (Pendiente, En Desarrollo, En Revision, Completada)</li>
       <li><strong>Hitos/sprints</strong> si el proyecto los tiene configurados</li>
      </ul>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Buena practica:</h4>
       <p className="text-xs text-muted-foreground">Revisa esta seccion regularmente para estar al tanto del avance sin necesidad de reuniones adicionales.</p>
      </div>
     </div>
    ),
   },
  ],
 },
 {
  id: 'tickets',
  title: 'Tickets',
  description: 'Como crear, dar seguimiento y comunicarte sobre solicitudes.',
  icon: Ticket,
  color: 'bg-amber-500/10 text-amber-500',
  sections: [
   {
    id: 'tickets-intro',
    title: 'Introduccion',
    content: (
     <div className="space-y-4">
      <p>El sistema de <strong>Tickets</strong> es el canal principal para reportar incidencias, solicitar soporte o pedir nuevas funcionalidades.</p>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Objetivo:</h4>
       <p className="text-sm text-muted-foreground">Centralizar todas las solicitudes en un solo lugar con trazabilidad completa: desde la creacion hasta la resolucion.</p>
      </div>
     </div>
    ),
   },
   {
    id: 'tickets-create',
    title: 'Crear un ticket',
    content: (
     <div className="space-y-4">
      <p>Para crear un ticket nuevo:</p>
      <ol className="list-decimal list-inside space-y-2 text-sm">
       <li>Haz clic en el boton <strong>"Nuevo ticket"</strong> en la esquina superior derecha.</li>
       <li>Selecciona el <strong>proyecto</strong> al que pertenece la solicitud.</li>
       <li>Escribe un <strong>titulo</strong> claro y descriptivo.</li>
       <li>Agrega una <strong>descripcion</strong> detallada del problema o solicitud.</li>
       <li>Selecciona la <strong>categoria</strong> (Soporte o Desarrollo).</li>
       <li>Opcionalmente, adjunta un <strong>archivo</strong> (imagen, PDF, documento).</li>
       <li>Haz clic en <strong>"Crear ticket"</strong>.</li>
      </ol>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Buena practica:</h4>
       <p className="text-xs text-muted-foreground">Un titulo claro como "Error al generar reporte de ventas" es mucho mejor que "No funciona". Incluye pasos para reproducir el problema si es posible.</p>
      </div>
     </div>
    ),
   },
   {
    id: 'tickets-status',
    title: 'Estados del ticket',
    content: (
     <div className="space-y-4">
      <p>Cada ticket pasa por los siguientes estados:</p>
      <div className="space-y-2">
       <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0"/>
        <div>
         <p className="text-sm font-semibold">Abierto</p>
         <p className="text-xs text-muted-foreground">El ticket fue creado y esta en espera de ser atendido por el equipo.</p>
        </div>
       </div>
       <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <span className="h-2.5 w-2.5 rounded-full bg-warning shrink-0"/>
        <div>
         <p className="text-sm font-semibold">En Proceso</p>
         <p className="text-xs text-muted-foreground">El equipo esta trabajando activamente en tu solicitud.</p>
        </div>
       </div>
       <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <span className="h-2.5 w-2.5 rounded-full bg-success shrink-0"/>
        <div>
         <p className="text-sm font-semibold">Resuelto</p>
         <p className="text-xs text-muted-foreground">La solicitud fue resuelta. Puedes verificar y confirmar.</p>
        </div>
       </div>
       <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground shrink-0"/>
        <div>
         <p className="text-sm font-semibold">Cerrado</p>
         <p className="text-xs text-muted-foreground">El ticket fue cerrado definitivamente.</p>
        </div>
       </div>
      </div>
     </div>
    ),
   },
   {
    id: 'tickets-chat',
    title: 'Chat del ticket',
    content: (
     <div className="space-y-4">
      <p>Cada ticket tiene un <strong>chat integrado</strong> para comunicarte directamente con el equipo:</p>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
       <li>Escribe mensajes en el campo de texto y presiona <strong>Enter</strong> o el boton de enviar.</li>
       <li>Puedes <strong>adjuntar archivos</strong> haciendo clic en el icono de clip.</li>
       <li>Los archivos se muestran como tarjetas descargables dentro del chat.</li>
       <li>Los mensajes se actualizan en <strong>tiempo real</strong> — no necesitas recargar la pagina.</li>
      </ul>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Formatos de archivo soportados:</h4>
       <p className="text-xs text-muted-foreground">Imagenes (JPG, PNG), PDF, documentos Word (.docx), Excel (.xlsx), CSV y archivos de texto.</p>
      </div>
     </div>
    ),
   },
   {
    id: 'tickets-filter',
    title: 'Filtros y busqueda',
    content: (
     <div className="space-y-4">
      <p>Puedes filtrar y buscar tus tickets de varias formas:</p>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
       <li><strong>Por estado</strong> — Usa las pestanas (Todos, Abiertos, En progreso, Resueltos, Cerrados).</li>
       <li><strong>Por texto</strong> — Escribe en el campo de busqueda para encontrar por titulo o numero de ticket.</li>
       <li><strong>Mis tickets</strong> — Activa el filtro para ver solo los tickets que creaste tu.</li>
      </ul>
     </div>
    ),
   },
  ],
 },
 {
  id: 'notifications',
  title: 'Notificaciones',
  description: 'Como funcionan las alertas y actualizaciones del sistema.',
  icon: Bell,
  color: 'bg-rose-500/10 text-rose-500',
  sections: [
   {
    id: 'notif-intro',
    title: 'Introduccion',
    content: (
     <div className="space-y-4">
      <p>Las <strong>notificaciones</strong> te mantienen informado sobre cambios y actualizaciones relevantes de tus proyectos y tickets.</p>
     </div>
    ),
   },
   {
    id: 'notif-types',
    title: 'Tipos de notificacion',
    content: (
     <div className="space-y-4">
      <p>Recibiras notificaciones cuando:</p>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
       <li>El equipo <strong>responda</strong> a uno de tus tickets.</li>
       <li>Un ticket cambie de <strong>estado</strong> (ej: de Abierto a En Proceso).</li>
       <li>Se complete una <strong>tarea</strong> en uno de tus proyectos.</li>
       <li>Haya <strong>actualizaciones</strong> importantes del equipo.</li>
      </ul>
     </div>
    ),
   },
   {
    id: 'notif-access',
    title: 'Como acceder',
    content: (
     <div className="space-y-4">
      <p>Puedes acceder a las notificaciones de dos formas:</p>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
       <li><strong>Icono de campana</strong> en el sidebar — Muestra un panel rapido con las ultimas notificaciones. El badge rojo indica cuantas no has leido.</li>
       <li><strong>Acceso rapido</strong> desde el Dashboard — La tarjeta "Notificaciones" en el panel de control te lleva a la vista completa.</li>
      </ul>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Consejo:</h4>
       <p className="text-xs text-muted-foreground">Las notificaciones se actualizan en tiempo real. Si ves el badge de la campana incrementarse, significa que hay algo nuevo sin necesidad de recargar.</p>
      </div>
     </div>
    ),
   },
  ],
 },
 {
  id: 'account',
  title: 'Mi Cuenta',
  description: 'Configuracion del perfil, contrasena y preferencias.',
  icon: Settings,
  color: 'bg-slate-500/10 text-slate-500',
  sections: [
   {
    id: 'account-intro',
    title: 'Introduccion',
    content: (
     <div className="space-y-4">
      <p>Desde <strong>Mi Cuenta</strong> puedes gestionar tu perfil y preferencias de acceso.</p>
     </div>
    ),
   },
   {
    id: 'account-password',
    title: 'Cambiar contrasena',
    content: (
     <div className="space-y-4">
      <p>Para cambiar tu contrasena:</p>
      <ol className="list-decimal list-inside space-y-2 text-sm">
       <li>Haz clic en tu <strong>avatar/nombre</strong> en la parte inferior del sidebar.</li>
       <li>Accede a la seccion de <strong>Configuracion</strong>.</li>
       <li>Ingresa tu contrasena actual y la nueva.</li>
       <li>Confirma el cambio.</li>
      </ol>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
       <h4 className="font-semibold text-sm mb-2">Primer inicio de sesion:</h4>
       <p className="text-xs text-muted-foreground">Si es tu primer acceso, el sistema te pedira automaticamente que cambies la contrasena temporal que te fue asignada.</p>
      </div>
     </div>
    ),
   },
   {
    id: 'account-theme',
    title: 'Modo oscuro / claro',
    content: (
     <div className="space-y-4">
      <p>Puedes cambiar entre <strong>modo claro y oscuro</strong> haciendo clic en el icono de sol/luna en el sidebar.</p>
      <p className="text-sm text-muted-foreground">La preferencia se guarda automaticamente y persiste entre sesiones.</p>
     </div>
    ),
   },
  ],
 },
];

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function PortalGuidePage() {
 const [activeModule, setActiveModule] = useState<string | null>(null);
 const [activeSection, setActiveSection] = useState<string>('');

 const currentModule = modules.find((m) => m.id === activeModule);

 const handleOpenModule = (moduleId: string) => {
  const mod = modules.find((m) => m.id === moduleId);
  if (mod) {
   setActiveModule(moduleId);
   setActiveSection(mod.sections[0]?.id || '');
  }
 };

 const handleBack = () => {
  setActiveModule(null);
  setActiveSection('');
 };

 const currentSection = currentModule?.sections.find((s) => s.id === activeSection);

 // ---- Card grid view ----
 if (!currentModule) {
  return (
   <div className="mx-auto max-w-5xl space-y-8 pb-4">
    <div>
     <div className="flex items-center gap-3 mb-1">
      <BookOpen className="h-6 w-6 text-primary"/>
      <h1 className="text-2xl font-bold text-foreground">Guia de Uso</h1>
     </div>
     <p className="text-sm text-muted-foreground">
      Selecciona un modulo para aprender como funciona cada seccion de la plataforma.
     </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     {modules.map((mod) => {
      const Icon = mod.icon;
      return (
       <button
        key={mod.id}
        onClick={() => handleOpenModule(mod.id)}
        className="group text-left rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30 hover:bg-muted/30"
       >
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl mb-4', mod.color)}>
         <Icon className="h-5 w-5"/>
        </div>
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
         {mod.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
         {mod.description}
        </p>
        <div className="flex items-center gap-1 mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
         Ver documentacion <ChevronRight className="h-3.5 w-3.5"/>
        </div>
       </button>
      );
     })}
    </div>
   </div>
  );
 }

 // ---- Module detail view with sidebar ----
 const ModuleIcon = currentModule.icon;

 return (
  <div className="mx-auto max-w-5xl pb-4">
   {/* Header */}
   <div className="mb-6">
    <button
     onClick={handleBack}
     className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-3"
    >
     <ChevronLeft className="h-4 w-4"/>
     Volver a Guia de Uso
    </button>
    <div className="flex items-center gap-3">
     <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', currentModule.color)}>
      <ModuleIcon className="h-5 w-5"/>
     </div>
     <div>
      <h1 className="text-xl font-bold text-foreground">{currentModule.title}</h1>
      <p className="text-sm text-muted-foreground">{currentModule.description}</p>
     </div>
    </div>
   </div>

   <div className="flex gap-6">
    {/* Sidebar index */}
    <nav className="hidden md:block w-56 shrink-0">
     <div className="sticky top-4 rounded-xl border border-border bg-card p-3 space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-2">
       Contenido
      </p>
      {currentModule.sections.map((section) => (
       <button
        key={section.id}
        onClick={() => setActiveSection(section.id)}
        className={cn(
         'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left',
         activeSection === section.id
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
       >
        {section.title}
       </button>
      ))}
     </div>
    </nav>

    {/* Content */}
    <div className="flex-1 min-w-0">
     {/* Mobile selector (above content) */}
     <div className="md:hidden mb-4">
      <select
       value={activeSection}
       onChange={(e) => setActiveSection(e.target.value)}
       className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      >
       {currentModule.sections.map((section) => (
        <option key={section.id} value={section.id}>{section.title}</option>
       ))}
      </select>
     </div>

     <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
       {currentSection?.title}
      </h2>
      <div className="text-sm text-foreground leading-relaxed">
       {currentSection?.content}
      </div>
     </div>

     {/* Prev / Next navigation */}
     <div className="flex items-center justify-between mt-4">
      {(() => {
       const idx = currentModule.sections.findIndex((s) => s.id === activeSection);
       const prev = idx > 0 ? currentModule.sections[idx - 1] : null;
       const next = idx < currentModule.sections.length - 1 ? currentModule.sections[idx + 1] : null;

       return (
        <>
         {prev ? (
          <button
           onClick={() => setActiveSection(prev.id)}
           className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
           <ChevronLeft className="h-4 w-4"/> {prev.title}
          </button>
         ) : <div/>}
         {next ? (
          <button
           onClick={() => setActiveSection(next.id)}
           className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
           {next.title} <ChevronRight className="h-4 w-4"/>
          </button>
         ) : <div/>}
        </>
       );
      })()}
     </div>
    </div>
   </div>
  </div>
 );
}
