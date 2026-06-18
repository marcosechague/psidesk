# TODO — Dashboard

## Contexto

Simplificamos el dashboard (`app/src/app/(app)/page.tsx`) para que quede liviano:
saludo + tarjetas de stats + **Sesiones de hoy** + **Carga de la semana**.

Sacamos el hero de "Tu próxima sesión" (la lista de hoy ya muestra la próxima
como primer ítem) y **tres tarjetas** que listamos abajo. La lógica de datos de
esas tres **sigue existiendo en `server/queries.ts`**, así que reincorporarlas es
volver a llamar la query y pegar el bloque de UI. Acá queda la idea de cómo
hacerlo mejor, no solo pegarlo de vuelta.

---

## 1. Conversaciones de WhatsApp del mes

- **Qué mostraba:** total de mensajes de WhatsApp del mes + desglose
  (seguimiento / recordatorio / avisos de cita / tests).
- **Query:** `getWhatsAppUsageForUser(userId)` → `{ total, checkin, reminder, appointment, test }`.
- **Por qué la sacamos:** un número suelto sin contexto de cupo no aporta. Es el
  futuro hogar del medidor de consumo del plan (ver memoria *business-model-mvp*:
  WhatsApp = muro de pago, métricas de consumo).
- **Cómo reincorporarla bien:** mostrarla como **cupo "X de N este mes"** con
  barra de progreso (verde → ámbar → rojo al acercarse al límite del plan), no
  como contador suelto. Vincular a una página de consumo/plan. Idealmente vive en
  el header o en una franja fina, no como tarjeta grande.

## 2. Para revisar

- **Qué mostraba:** tests que el paciente completó y el profesional todavía no
  abrió, con link "Ver informe".
- **Datos:** `novedades` del `getDashboardData(userId)` (campo `novedades`:
  `{ patientName, text, when, href }[]`). El número ya está en la tarjeta de stats
  ("Informes sin ver" = `stats.toReview`).
- **Por qué la sacamos:** duplicaba el stat "Informes sin ver" y alargaba la
  pantalla.
- **Cómo reincorporarla bien:** hacer que la tarjeta de stat **"Informes sin ver"
  sea clickeable** y lleve a una vista/bandeja de informes pendientes, en vez de
  repetir la lista en el home. O un drawer/acordeón que se abre desde ese stat.

## 3. Requieren atención

- **Qué mostraba:** alertas clínicas accionables — pacientes que **empeoraron** en
  un test (`worsening`) y pacientes **inactivos** (`inactive`), con link a su ficha
  y a `/panel`.
- **Query:** `getPracticeInsights(userId)` → `{ worsening, inactive }`.
- **Por qué la sacamos:** el `/panel` ya tiene esta info completa; en el home
  competía con la tarea del día.
- **Cómo reincorporarla bien:** mostrar **solo un aviso compacto** ("2 pacientes
  requieren atención →") que lleve al `/panel`, en lugar de la lista entera. Que
  aparezca únicamente cuando hay alertas y sin ocupar tanto espacio.

---

## Notas

- Ninguna query fue borrada — `getWhatsAppUsageForUser`, `getPracticeInsights` y el
  campo `novedades` de `getDashboardData` siguen disponibles.
- El hero "Tu próxima sesión" del `DayBoard` se eliminó junto con su prop `next`.
  Si se quisiera volver, está en el historial de git (componente
  `app/src/components/features/dashboard/DayBoard.tsx`).
