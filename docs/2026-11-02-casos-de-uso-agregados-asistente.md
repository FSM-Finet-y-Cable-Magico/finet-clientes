# Casos de uso agregados al asistente virtual — CU-81, CU-82 y CU-83

**Fecha:** 2026-11-02 · **Rama:** `incremento-3/chatbot` · **Alcance:** bloque del asistente virtual (lo lleva Dani)

Se agregaron tres casos de uso al catálogo, en
[`CASOS-DE-USO.md`](CASOS-DE-USO.md#casos-agregados-fuera-del-documento-fuente).
**No vienen del documento fuente** (`CU_por_Incremento`): describen funcionalidad
del asistente que ya estaba construida y probada, y que ningún caso de los 80
originales describe. No se escribió código nuevo para ellos.

Resumen:

| CU | Caso de uso | Actor | Estado |
|---|---|---|---|
| CU-81 | Reiniciando la conversación con el asistente virtual | Visitante | ✅ Implementado y con tests |
| CU-82 | Abriendo el asistente virtual y retomando la conversación | Visitante | ✅ Implementado y con tests |
| CU-83 | Limitando los mensajes al asistente virtual por IP | Sistema | ✅ Implementado y con tests |

## Qué significa que estén "agregados"

- **Se numeran desde el CU-81**, después del último del documento fuente (CU-80),
  para no pisar ningún número existente.
- **No cuentan en los 80 casos ni en los porcentajes por incremento.** La tabla del
  principio de `CASOS-DE-USO.md` sigue igual. Pasarán a contar solo si el equipo los
  acepta y se incorporan a `CU_por_Incremento`.
- **Están en una sección aparte**, "Casos agregados fuera del documento fuente",
  después de la tabla del Incremento 3 + 4, con un aviso que lo dice.

**Pendiente:** que el equipo (y quien mantiene `CU_por_Incremento`) decida si se
incorporan al documento fuente, y en qué incremento.

## Por qué estos tres y no otros

El criterio fue que cada caso cumpliera tres condiciones:

1. Que el código ya lo haga, de punta a punta, y tenga tests.
2. Que sea un objetivo propio del actor, no un paso de otro caso.
3. Que ningún caso existente lo cubra.

Por eso quedaron fuera:

- **Recibir mensajes desde Chatwoot:** el código del webhook existe, pero Chatwoot no
  está conectado. No se cumple.
- **El reinicio tras 48 horas, el modo general sin RUT, las categorías de falla y el
  aviso por correo a Soporte:** ya son parte del CU-63, el CU-66 y el CU-77.
  Separarlos contaría dos veces lo mismo.
- **Ocultar el RUT y no guardar el texto en los logs:** son requisitos no
  funcionales, no casos de uso.
- **CU-70 (derivar a un operador humano) y CU-79 (auditar el historial de
  sesiones):** son del documento fuente y siguen sin cumplirse. Hoy nadie retoma la
  conversación en el chat, y el historial vive en la memoria del chatbot.

## Los tres casos

El detalle completo de cada uno (precondición, flujo principal, excepciones y
poscondición) está en `CASOS-DE-USO.md`. Aquí va lo esencial.

### CU-81 — Reiniciando la conversación con el asistente virtual

El visitante empieza una conversación de cero con el botón "Nueva conversación" de
la cabecera del panel, o con "Iniciar nueva conversación" cuando la anterior terminó
porque se derivó a una persona o porque el asistente no respondió.

- El widget borra los mensajes y la conversación guardada en el navegador, y descarta
  el identificador de sesión. Con el siguiente mensaje genera uno nuevo, así que
  finet-chatbot vuelve a pedir el RUT (CU-63).
- No se puede reiniciar mientras se espera una respuesta.
- La conversación anterior no se borra en finet-chatbot, y si tenía un ticket
  (CU-77), sigue en el CRM.

**Implementación:** `nuevaConversacion()` en
`apps/view/app/_components/asistente/AsistenteWidget.tsx`.
**Pruebas:** `apps/view/app/__tests__/AsistenteWidget.test.tsx`.

### CU-82 — Abriendo el asistente virtual y retomando la conversación

El visitante abre el asistente desde el botón flotante, presente en todas las
páginas, y si conversó hace menos de 48 horas, retoma la conversación donde la dejó.

- Se restauran los mensajes, la sesión y si la conversación había terminado. Como la
  sesión es la misma, finet-chatbot no vuelve a pedir el RUT.
- Si la conversación guardada tiene más de 48 horas o está dañada, se descarta y se
  empieza una nueva.
- El panel se cierra con el botón o con Escape, y el foco vuelve al botón flotante.
- Funciona aunque el navegador no permita guardar datos; solo que la conversación no
  sobrevive a una recarga.

**Complementa al CU-65, sin repetirlo:** el CU-65 es cómo responde el asistente; el
CU-82, cómo llega el visitante a él y cómo recupera lo conversado.

**Implementación:** `abrir()` y `leerConversacion()` en
`apps/view/app/_components/asistente/AsistenteWidget.tsx`, montado en
`apps/view/app/layout.tsx`.
**Pruebas:** `apps/view/app/__tests__/AsistenteWidget.test.tsx`.

### CU-83 — Limitando los mensajes al asistente virtual por IP

El backend acepta hasta 10 mensajes por minuto por IP en `POST /api/asistente/mensajes`.
Protege el motor de lenguaje, que Finet paga por uso, y frena a quien pruebe RUTs al
azar.

- Pasado el límite, el backend responde `429` sin llamar a finet-chatbot. El widget
  avisa "Estás enviando mensajes muy seguido…" y devuelve el mensaje al campo de texto
  para reenviarlo sin duplicarlo.
- Las consultas que hace finet-chatbot con su clave tienen un límite propio de 600 por
  minuto, porque salen todas de una sola IP en nombre de todos los clientes del chat.

Es más una regla del sistema que una acción del visitante, y podría leerse como un
requisito no funcional. Se dejó como caso de uso porque tiene un flujo y una excepción
que el visitante ve.

**Implementación:** `@Throttle` en `apps/controller/src/asistente/asistente.controller.ts`
y `limitePorMinuto()` en `apps/controller/src/asistente/limite-chatbot.ts`.
**Pruebas:** `apps/controller/src/asistente/limite-chatbot.spec.ts` y
`apps/view/app/__tests__/AsistenteWidget.test.tsx`.

## Verificación

El 2026-11-02 se revisó cada afirmación de los tres casos contra el código y se
corrieron los tests que citan:

- `AsistenteWidget.test.tsx`: 17 de 17.
- `limite-chatbot.spec.ts`: 5 de 5.
