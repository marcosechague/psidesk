# Plantillas de WhatsApp (Meta) — Psidesk

Guía para crear y configurar las **plantillas (templates)** de WhatsApp que usa
Psidesk. Pensada para subir a Notion.

---

## 1. Por qué hacen falta plantillas

WhatsApp (Meta) **no deja iniciar una conversación con texto libre**. Solo se
puede mandar texto libre **dentro de las 24 h** posteriores al último mensaje del
paciente. Para escribirle *primero* (un check-in programado, un recordatorio, un
aviso de cita) hay que usar una **plantilla pre-aprobada por Meta**.

- Cada plantilla se crea y se aprueba **una vez** en el panel de Meta.
- El cuerpo es **fijo**; solo cambian las **variables** (`{{1}}`, `{{2}}`, …) que
  Psidesk completa en cada envío.
- **Categoría**: todas las nuestras son **Utility** (utilitarias / de servicio),
  no Marketing. Es más barato y tiene mejor entrega.

### Costo (resumen)
- Se cobra **por conversación iniciada** con plantilla (la primera).
- En el check-in, una vez que el paciente responde, todo lo que sigue (opciones,
  acuse) viaja **gratis** dentro de la ventana de 24 h.
- Por eso Psidesk mide el consumo por tipo (seguimiento / recordatorios / avisos).

---

## 2. Reglas de Meta al escribir el cuerpo

Importante respetarlas o la plantilla se **rechaza**:

1. **Una variable no puede ir al principio ni al final** del cuerpo. Tiene que
   haber texto fijo antes y después (por eso siempre hay un saludo y un cierre).
2. **Dos variables no pueden ir pegadas** (`{{1}} {{2}}`). Tiene que haber texto
   real entre ellas.
3. **Las variables no pueden contener saltos de línea ni tabs.** El salto de
   línea va en el texto fijo del cuerpo, no en el valor de la variable.
4. El **idioma** de la plantilla debe coincidir con el que configures en Psidesk
   (ej. `es`). Si la creás como "Español (es)", usá `es`.
5. El **nombre** de la plantilla va en minúsculas y con guiones bajos
   (ej. `seguimiento_checkin`).

---

## 3. Las tres plantillas

> En los ejemplos, lo que está entre `{{ }}` es una variable que completa Psidesk.
> El resto es texto fijo que escribís vos en Meta.

### 3.1 Seguimiento (check-in)

Pregunta de seguimiento programada que se le manda al paciente. Lleva un **botón
de respuesta rápida** "Responder": al tocarlo, Psidesk le manda las opciones
(escala 1-10 / sí-no / opción) ya dentro de la ventana de 24 h.

- **Nombre sugerido**: `seguimiento_checkin`
- **Categoría**: Utility
- **Idioma**: Español (`es`)
- **Botones**: un botón de **Respuesta rápida (Quick reply)** con el texto
  `Responder`.

**Cuerpo:**

```
Hola {{1}}, te escribe {{2}}.

{{3}}

Tocá el botón "Responder" para contestar. 🙂
```

**Variables:**

| Variable | Contenido            | Ejemplo            |
|----------|----------------------|--------------------|
| `{{1}}`  | Nombre del paciente  | Ana                |
| `{{2}}`  | Nombre del profesional | Lic. María López |
| `{{3}}`  | La pregunta del check-in | ¿Cómo dormiste esta semana? |

**Cómo se ve:**

> Hola Ana, te escribe Lic. María López.
> ¿Cómo dormiste esta semana?
> Tocá el botón "Responder" para contestar. 🙂
> [ Responder ]

**Variables de entorno:**
```
WHATSAPP_TEMPLATE_NAME="seguimiento_checkin"
WHATSAPP_TEMPLATE_LANG="es"
```

---

### 3.2 Recordatorio de cita

Aviso que se manda **antes** de la sesión (lo dispara el cron según los minutos
configurados en cada sesión). Solo por WhatsApp (paciente con teléfono +
consentimiento).

- **Nombre sugerido**: `recordatorio_cita`
- **Categoría**: Utility
- **Idioma**: Español (`es`)
- **Botones**: ninguno.

**Cuerpo:**

```
Hola {{1}}, te recordamos tu sesión con {{2}}.

📅 {{3}}

Si no podés asistir, avisanos con tiempo.
```

**Variables:**

| Variable | Contenido            | Ejemplo                       |
|----------|----------------------|-------------------------------|
| `{{1}}`  | Nombre del paciente  | Ana                           |
| `{{2}}`  | Nombre del profesional | Lic. María López            |
| `{{3}}`  | Fecha y hora         | lunes 9 de junio, 10:00       |

**Cómo se ve:**

> Hola Ana, te recordamos tu sesión con Lic. María López.
> 📅 lunes 9 de junio, 10:00
> Si no podés asistir, avisanos con tiempo.

**Variables de entorno:**
```
WHATSAPP_REMINDER_TEMPLATE_NAME="recordatorio_cita"
WHATSAPP_REMINDER_TEMPLATE_LANG="es"
```

---

### 3.3 Aviso de cita (agendada / reprogramada / cancelada)

Aviso inmediato cuando el profesional **agenda, reprograma o cancela** una cita.
Un solo template cubre los tres casos: la acción viaja como variable.

- **Nombre sugerido**: `aviso_cita`
- **Categoría**: Utility
- **Idioma**: Español (`es`)
- **Botones**: ninguno.

**Cuerpo:**

```
Hola {{1}}, {{2}} te {{3}} una sesión.

📅 {{4}}
```

**Variables:**

| Variable | Contenido            | Ejemplo                       |
|----------|----------------------|-------------------------------|
| `{{1}}`  | Nombre del paciente  | Ana                           |
| `{{2}}`  | Nombre del profesional | Lic. María López            |
| `{{3}}`  | Acción               | agendó / reprogramó / canceló |
| `{{4}}`  | Fecha y hora         | lunes 9 de junio, 10:00       |

**Cómo se ve (agendada):**

> Hola Ana, Lic. María López te agendó una sesión.
> 📅 lunes 9 de junio, 10:00

> ⚠️ Como `{{3}}` cambia el verbo, escribí el cuerpo en pasado neutro
> ("te {{3}} una sesión") para que funcione con las tres acciones:
> "te agendó", "te reprogramó", "te canceló".

**Variables de entorno:**
```
WHATSAPP_APPOINTMENT_TEMPLATE_NAME="aviso_cita"
WHATSAPP_APPOINTMENT_TEMPLATE_LANG="es"
```

---

### 3.4 Test asignado

Aviso cuando el profesional **asigna un test** al paciente. Incluye el **link**
para responderlo. Solo por WhatsApp.

- **Nombre sugerido**: `test_asignado`
- **Categoría**: Utility
- **Idioma**: Español (`es`)
- **Botones**: ninguno (el link va en el cuerpo).

**Cuerpo:**

```
Hola {{1}}, {{2}} te asignó el test "{{3}}".

Completalo acá: {{4}}
```

**Variables:**

| Variable | Contenido            | Ejemplo                         |
|----------|----------------------|---------------------------------|
| `{{1}}`  | Nombre del paciente  | Ana                             |
| `{{2}}`  | Nombre del profesional | Lic. María López              |
| `{{3}}`  | Nombre del test      | Inventario de ansiedad          |
| `{{4}}`  | Link para responder  | https://app.psidesk.com/r/ab12… |

**Variables de entorno:**
```
WHATSAPP_TEST_ASSIGNED_TEMPLATE_NAME="test_asignado"
WHATSAPP_TEST_ASSIGNED_TEMPLATE_LANG="es"
```

---

### 3.5 Recordatorio de test

Recordatorio de **completar un test antes del deadline**, si el paciente todavía
no lo respondió. Pueden ser varios (ej. 2 días antes, 1 día antes, el día tope);
cada uno se manda una sola vez. Solo por WhatsApp.

- **Nombre sugerido**: `recordatorio_test`
- **Categoría**: Utility
- **Idioma**: Español (`es`)
- **Botones**: ninguno.

**Cuerpo:**

```
Hola {{1}}, {{2}} te recuerda completar el test "{{3}}" antes del {{4}}.

Respondé acá: {{5}}
```

**Variables:**

| Variable | Contenido            | Ejemplo                         |
|----------|----------------------|---------------------------------|
| `{{1}}`  | Nombre del paciente  | Ana                             |
| `{{2}}`  | Nombre del profesional | Lic. María López              |
| `{{3}}`  | Nombre del test      | Inventario de ansiedad          |
| `{{4}}`  | Fecha tope           | lunes 9 de junio                |
| `{{5}}`  | Link para responder  | https://app.psidesk.com/r/ab12… |

**Variables de entorno:**
```
WHATSAPP_TEST_REMINDER_TEMPLATE_NAME="recordatorio_test"
WHATSAPP_TEST_REMINDER_TEMPLATE_LANG="es"
```

> **Sobre el link en el cuerpo:** mandamos el link como **variable de texto**
> (`{{4}}` / `{{5}}`). Es lo más simple y Meta suele aprobarlo en plantillas
> Utility. Si en tu cuenta lo rechaza, la alternativa es un **botón de URL
> dinámica** (el token va como parámetro del botón) — requiere un pequeño cambio
> en el código de envío, queda como mejora futura.

---

## 4. Cómo crear una plantilla en Meta (paso a paso)

1. Entrá a **WhatsApp Manager** → https://business.facebook.com/wa/manage/
   (o desde **Meta Business Suite** → WhatsApp → Plantillas de mensajes).
2. **Crear plantilla**.
3. **Categoría**: elegí **Utility (Utilidad)**.
4. **Nombre**: en minúsculas con guiones bajos (ej. `seguimiento_checkin`).
5. **Idioma**: **Español** (te lo guarda como `es`).
6. **Cuerpo (Body)**: pegá el texto de la sección 3 correspondiente, con las
   `{{1}}`, `{{2}}`… donde van.
7. En **Sample / Muestra**, completá ejemplos de cada variable (Meta los pide
   para revisar). Usá los de las tablas de arriba.
8. (Solo el check-in) **Botones** → agregá un botón de **Respuesta rápida** con
   el texto `Responder`.
9. **Enviar / Submit**. Meta lo revisa (suele tardar de minutos a unas horas).
10. Cuando figure **Aprobado (Approved)**, copiá el **nombre** y el **idioma** y
    cargalos en las variables de entorno (sección 5).

> Si una plantilla queda **Rechazada**, casi siempre es por las reglas de la
> sección 2 (variable al principio/final, dos variables pegadas, categoría mal
> elegida). Corregí y reenviá.

---

## 5. Variables de entorno (resumen)

Conexión con Meta Cloud API (necesarias para enviar de verdad):

```
WHATSAPP_DRIVER="cloud"                 # "mock" = solo loguea (dev); "cloud" = envía
WHATSAPP_TOKEN="EAAG..."                # access token del número
WHATSAPP_PHONE_NUMBER_ID="123456789012345"
WHATSAPP_API_VERSION="v22.0"            # opcional
WHATSAPP_VERIFY_TOKEN="..."             # para verificar el webhook
```

Plantillas:

```
WHATSAPP_TEMPLATE_NAME="seguimiento_checkin"
WHATSAPP_TEMPLATE_LANG="es"

WHATSAPP_REMINDER_TEMPLATE_NAME="recordatorio_cita"
WHATSAPP_REMINDER_TEMPLATE_LANG="es"

WHATSAPP_APPOINTMENT_TEMPLATE_NAME="aviso_cita"
WHATSAPP_APPOINTMENT_TEMPLATE_LANG="es"

WHATSAPP_TEST_ASSIGNED_TEMPLATE_NAME="test_asignado"
WHATSAPP_TEST_ASSIGNED_TEMPLATE_LANG="es"

WHATSAPP_TEST_REMINDER_TEMPLATE_NAME="recordatorio_test"
WHATSAPP_TEST_REMINDER_TEMPLATE_LANG="es"
```

> Si **no** definís el nombre de una plantilla, Psidesk manda **texto** en vez de
> plantilla. Eso **solo llega dentro de la ventana de 24 h** (sirve en
> desarrollo/mock, no para envíos programados reales).

---

## 6. Checklist de puesta en producción

- [ ] Número de WhatsApp Business conectado a la Cloud API (token + phone number id).
- [ ] Webhook configurado y verificado (para recibir las respuestas).
- [ ] Plantilla `seguimiento_checkin` aprobada (con botón "Responder").
- [ ] Plantilla `recordatorio_cita` aprobada.
- [ ] Plantilla `aviso_cita` aprobada.
- [ ] Plantilla `test_asignado` aprobada.
- [ ] Plantilla `recordatorio_test` aprobada.
- [ ] Variables de entorno cargadas (sección 5) y `WHATSAPP_DRIVER="cloud"`.
- [ ] Prueba real: enviar un check-in y un recordatorio a un número propio.
