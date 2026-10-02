"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { api } from "../../utils/api";
import { COMPANY_PHONE_DISPLAY, WHATSAPP_URL } from "../../_lib/company";

type Mensaje = { rol: "usuario" | "asistente"; texto: string };

/**
 * `terminada`: el asistente derivó a una persona y ya no responde en esta
 * sesión. Solo queda empezar una conversación nueva.
 */
type Conversacion = {
  idSesion: string;
  mensajes: Mensaje[];
  terminada: boolean;
};

type ConversacionGuardada = Conversacion & { ultimaActividad: number };

type RespuestaAsistente = { respuesta: string | null; derivado?: boolean };

/** Mismo tope que valida el backend (MAX_LARGO_MENSAJE en apps/controller). */
const MAX_LARGO_MENSAJE = 1000;

const STORAGE_KEY = "finet-asistente";

/**
 * CU-63: pasadas 48 horas sin interacción la conversación empieza de nuevo y
 * el asistente vuelve a pedir el RUT. El chatbot aplica el mismo plazo; acá
 * solo se evita mostrar una conversación que del otro lado ya no existe.
 */
const LIMITE_INACTIVIDAD_MS = 48 * 60 * 60 * 1000;

const BIENVENIDA =
  "¡Hola! Soy el asistente virtual de Finet. ¿En qué te puedo ayudar?";

/**
 * La conversación vive en localStorage para que sobreviva a cerrar la pestaña
 * y volver dentro de 48 horas (CU-63). El historial que ve el motor y la
 * identificación del cliente los guarda el chatbot bajo `idSesion`, así que
 * perderla solo empieza una conversación nueva.
 *
 * Todo acceso va en try/catch: el storage puede estar bloqueado (modo
 * privado, cookies deshabilitadas) y el widget tiene que funcionar igual.
 */
function leerConversacion(): Conversacion | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ConversacionGuardada>;
    if (
      typeof data.idSesion !== "string" ||
      !Array.isArray(data.mensajes) ||
      typeof data.ultimaActividad !== "number" ||
      Date.now() - data.ultimaActividad > LIMITE_INACTIVIDAD_MS
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      idSesion: data.idSesion,
      mensajes: data.mensajes,
      terminada: data.terminada === true,
    };
  } catch {
    return null;
  }
}

function guardarConversacion(conversacion: Conversacion | null) {
  try {
    if (conversacion) {
      const guardada: ConversacionGuardada = {
        ...conversacion,
        ultimaActividad: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guardada));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Sin storage la conversación sigue funcionando, solo no sobrevive a una recarga.
  }
}

/**
 * CU-65, excepción 1: el asistente no respondió o se pasó del tiempo. Mismo
 * texto que da finet-chatbot cuando falla su motor; acá cubre el caso en que
 * no responde ni el chatbot. El CU pide decir que un agente humano tomará el
 * caso, pero todavía no hay ninguno: el texto dice lo que sí existe.
 */
const SIN_RESPUESTA =
  "No pude responder en este momento. Una persona de nuestro equipo puede " +
  `atenderte por WhatsApp al ${COMPANY_PHONE_DISPLAY}. Desde aquí ya no podré ` +
  "responder más mensajes en esta conversación.";

function statusDeError(error: unknown): unknown {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status: unknown }).status
    : undefined;
}

/**
 * Errores del lado del visitante, que se arreglan reenviando: ir muy rápido
 * (429) o un mensaje que el backend rechazó (400). Cualquier otro es el
 * asistente sin responder.
 */
function esReintentable(status: unknown): boolean {
  return status === 429 || status === 400;
}

function mensajeDeError(status: unknown): string {
  if (status === 429) {
    return "Estás enviando mensajes muy seguido. Espera un momento e inténtalo de nuevo.";
  }
  return "No se pudo enviar tu mensaje. Revísalo e inténtalo de nuevo.";
}

/**
 * CU-65: widget del asistente virtual, presente en todo el sitio.
 *
 * Botón flotante abajo a la derecha (DESIGN.md, "Support & Chat") que abre un
 * panel de conversación. Habla con `POST /asistente/mensajes` del backend,
 * que reenvía a finet-chatbot.
 */
export default function AsistenteWidget() {
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [idSesion, setIdSesion] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminada, setTerminada] = useState(false);

  const botonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const reiniciarRef = useRef<HTMLButtonElement>(null);

  // El foco sigue a lo que se puede hacer: escribir, o empezar de nuevo
  // cuando la conversación terminó.
  useEffect(() => {
    if (!abierto) return;
    if (terminada) reiniciarRef.current?.focus();
    else inputRef.current?.focus();
  }, [abierto, terminada]);

  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensajes, enviando, abierto]);

  function abrir() {
    // Se lee al abrir y no al montar: el panel cerrado no necesita la
    // conversación, y así el render del servidor y el del cliente coinciden.
    if (!cargado) {
      const guardada = leerConversacion();
      if (guardada) {
        setIdSesion(guardada.idSesion);
        setMensajes(guardada.mensajes);
        setTerminada(guardada.terminada);
      }
      setCargado(true);
    }
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    botonRef.current?.focus();
  }

  function nuevaConversacion() {
    setIdSesion(null);
    setMensajes([]);
    setError(null);
    setTerminada(false);
    guardarConversacion(null);
    inputRef.current?.focus();
  }

  async function enviar() {
    const texto = borrador.trim();
    if (!texto || enviando || terminada) return;

    const sesion = idSesion ?? crypto.randomUUID();
    const conPregunta: Mensaje[] = [...mensajes, { rol: "usuario", texto }];

    setIdSesion(sesion);
    setMensajes(conPregunta);
    setBorrador("");
    setError(null);
    setEnviando(true);

    try {
      const { respuesta, derivado = false } =
        await api.post<RespuestaAsistente>("/asistente/mensajes", {
          id_sesion: sesion,
          mensaje: texto,
        });
      // Sin respuesta, la conversación ya estaba derivada y el chatbot
      // descartó el mensaje: no se muestra como si se hubiera enviado.
      const conRespuesta: Mensaje[] =
        respuesta === null
          ? mensajes
          : [...conPregunta, { rol: "asistente", texto: respuesta }];
      setMensajes(conRespuesta);
      setTerminada(derivado);
      guardarConversacion({
        idSesion: sesion,
        mensajes: conRespuesta,
        terminada: derivado,
      });
    } catch (e) {
      const status = statusDeError(e);
      if (esReintentable(status)) {
        // El chatbot no recibió el turno: se saca la pregunta de la lista y
        // vuelve al input, para reenviarla sin duplicarla.
        setMensajes(mensajes);
        setBorrador(texto);
        setError(mensajeDeError(status));
        return;
      }

      // CU-65, excepción 1: se termina como una derivación, igual que hace
      // el chatbot cuando su motor no responde.
      const conAviso: Mensaje[] = [
        ...conPregunta,
        { rol: "asistente", texto: SIN_RESPUESTA },
      ];
      setMensajes(conAviso);
      setTerminada(true);
      guardarConversacion({
        idSesion: sesion,
        mensajes: conAviso,
        terminada: true,
      });
    } finally {
      setEnviando(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void enviar();
  }

  function onKeyDownInput(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía, Shift+Enter agrega una línea. No mientras se compone un
    // carácter con IME (acentos en algunos teclados).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void enviar();
    }
  }

  function onKeyDownPanel(e: React.KeyboardEvent) {
    if (e.key === "Escape") cerrar();
  }

  return (
    <>
      {abierto && (
        <section
          id="asistente-panel"
          role="dialog"
          aria-label="Asistente virtual de Finet"
          onKeyDown={onKeyDownPanel}
          className="fixed bottom-24 right-4 z-40 flex h-[min(34rem,calc(100dvh-8rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl sm:right-6"
        >
          <header className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-background">
            <div>
              <h2 className="text-sm font-semibold">Asistente Finet</h2>
              <p className="text-xs opacity-90">Respuestas automáticas</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={nuevaConversacion}
                disabled={enviando || mensajes.length === 0}
                aria-label="Nueva conversación"
                title="Nueva conversación"
                className="rounded-md p-1.5 transition hover:bg-background/15 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-background"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar asistente"
                className="rounded-md p-1.5 transition hover:bg-background/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-background"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div
            ref={listaRef}
            role="log"
            aria-live="polite"
            aria-label="Conversación"
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            <Burbuja rol="asistente" texto={BIENVENIDA} />
            {mensajes.map((m, i) => (
              <Burbuja key={i} rol={m.rol} texto={m.texto} />
            ))}
            {enviando && (
              <p className="mr-auto flex items-center gap-1 rounded-lg rounded-bl-sm bg-surface px-3 py-2 text-sm text-muted">
                <span className="sr-only">El asistente está escribiendo</span>
                <span aria-hidden="true" className="animate-pulse">
                  Escribiendo…
                </span>
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mx-3 mb-2 rounded-md bg-error-container px-3 py-2 text-xs text-on-error-container"
            >
              {error}
            </p>
          )}

          {terminada ? (
            <div className="flex flex-col gap-2 border-t border-border px-3 pt-3">
              <p className="text-center text-xs text-muted">
                Esta conversación terminó.
              </p>
              <button
                ref={reiniciarRef}
                type="button"
                onClick={nuevaConversacion}
                className="h-10 rounded-lg bg-primary text-sm font-semibold text-background transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Iniciar nueva conversación
              </button>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="flex items-end gap-2 border-t border-border px-3 pt-3"
            >
              <textarea
                ref={inputRef}
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={onKeyDownInput}
                rows={1}
                maxLength={MAX_LARGO_MENSAJE}
                placeholder="Escribe tu consulta…"
                aria-label="Escribe tu mensaje"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
              />
              <button
                type="submit"
                disabled={enviando || borrador.trim() === ""}
                aria-label="Enviar mensaje"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-background transition hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          )}

          <p className="px-3 pb-3 pt-2 text-[11px] leading-snug text-muted">
            Las respuestas las genera una IA y pueden contener errores. Solo te
            pediremos tu RUT para identificarte: nunca compartas contraseñas.
            Para trámites, escríbenos por{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              WhatsApp
            </a>
            .
          </p>
        </section>
      )}

      <button
        ref={botonRef}
        type="button"
        onClick={abierto ? cerrar : abrir}
        aria-expanded={abierto}
        aria-controls="asistente-panel"
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente virtual"}
        className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-background shadow-lg transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:right-6"
      >
        {abierto ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </>
  );
}

function Burbuja({ rol, texto }: Mensaje) {
  const esUsuario = rol === "usuario";
  return (
    <p
      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
        esUsuario
          ? "ml-auto rounded-br-sm bg-primary text-background"
          : "mr-auto rounded-bl-sm bg-surface text-foreground"
      }`}
    >
      <span className="sr-only">{esUsuario ? "Tú: " : "Asistente: "}</span>
      {texto}
    </p>
  );
}
