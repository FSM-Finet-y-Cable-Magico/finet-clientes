/**
 * CU-34 / CU-35: medicion de velocidad de la conexion del cliente contra la
 * infraestructura de fast.com (Netflix Open Connect).
 *
 * La medicion corre en el navegador y no en el servidor: si saliera del
 * servidor mediria la conexion del datacenter, no la del cliente, que es lo que
 * piden CU-34 y CU-35 (actor Cliente). Por eso no se usa la libreria
 * `fast-speedtest-api`, que es Node-only, sino que se porta su protocolo.
 *
 * La unica parte que si pasa por el backend es el descubrimiento de servidores:
 * `api.fast.com` responde con `Access-Control-Allow-Origin` solo para
 * `https://fast.com`, asi que desde nuestro origen el navegador no puede
 * leerla. La transferencia en cambio va directo, porque los CDN de Netflix si
 * responden con `*`.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const DURACION_BAJADA_MS = 10_000;
const DURACION_SUBIDA_MS = 8_000;
const MUESTRAS_LATENCIA = 5;
const BYTES_POR_DESCARGA = 26_214_400; // 25 MB, el tamano que sirve fast.com
const BYTES_POR_SUBIDA = 2_097_152; // 2 MB por request

/**
 * La conexion no arranca a su velocidad final: TCP sube de a poco durante los
 * primeros segundos. Todo lo transferido en esa rampa se descarta, porque si no
 * el resultado queda lastrado hacia abajo para siempre.
 */
const CALENTAMIENTO_MS = 3_000;
const VENTANA_INSTANTANEA_MS = 1_000;

/**
 * Acumula bytes y calcula la tasa **sostenida**: la del tramo posterior al
 * calentamiento, no el promedio desde cero.
 *
 * La diferencia no es menor. Midiendo el promedio acumulado una conexion que en
 * realidad da 290 Mbps se reporta como 230, porque el promedio nunca se
 * despega de los primeros segundos lentos.
 */
function crearMedidor() {
  const inicio = performance.now();
  let bytes = 0;

  // Marca de referencia: bytes y tiempo al terminar el calentamiento.
  let bytesBase = 0;
  let tiempoBase: number | null = null;

  // Tasa instantanea: es la que se muestra en vivo mientras corre la prueba.
  let bytesPrevios = 0;
  let tiempoPrevio = 0;
  let instantanea = 0;

  return {
    sumar(n: number) {
      bytes += n;
    },

    /** Devuelve la tasa instantanea actual en Mbps. */
    tick(): number {
      const t = performance.now() - inicio;

      if (tiempoBase === null && t >= CALENTAMIENTO_MS) {
        tiempoBase = t;
        bytesBase = bytes;
      }

      if (t - tiempoPrevio >= VENTANA_INSTANTANEA_MS) {
        instantanea = aMbps(bytes - bytesPrevios, t - tiempoPrevio);
        bytesPrevios = bytes;
        tiempoPrevio = t;
      }

      return instantanea;
    },

    /** Resultado final: solo el tramo posterior al calentamiento. */
    resultado(): number {
      const t = performance.now() - inicio;
      if (tiempoBase === null) {
        // No alcanzo a pasar el calentamiento: no queda mas que el promedio.
        return aMbps(bytes, t);
      }
      return aMbps(bytes - bytesBase, t - tiempoBase);
    },

    get total() {
      return bytes;
    },

    get transcurrido() {
      return performance.now() - inicio;
    },
  };
}

export type FaseMedicion = "descubriendo" | "latencia" | "bajada" | "subida";

export type ProgresoMedicion = {
  fase: FaseMedicion;
  /** Valor parcial en vivo de la fase en curso, en Mbps. */
  mbps?: number;
  /** Avance total de la prueba, de 0 a 1. */
  progreso: number;
};

/**
 * Tramo de la barra que ocupa cada fase. Reparten el 100% segun lo que dura
 * cada una: la bajada y la subida son las largas, las otras dos son casi
 * instantaneas.
 */
const TRAMO_FASE: Record<FaseMedicion, [number, number]> = {
  descubriendo: [0, 0.05],
  latencia: [0.05, 0.15],
  bajada: [0.15, 0.65],
  subida: [0.65, 1],
};

/** Convierte el avance dentro de una fase (0 a 1) en avance total. */
function progresoTotal(fase: FaseMedicion, avance: number): number {
  const [desde, hasta] = TRAMO_FASE[fase];
  return desde + (hasta - desde) * Math.min(Math.max(avance, 0), 1);
}

export type ResultadoVelocidad = {
  /** Latencia con la linea en reposo. */
  latenciaMs: number | null;
  /**
   * Latencia medida mientras la descarga satura el enlace. La diferencia con la
   * anterior es el bufferbloat: cuanto se degrada la respuesta del enlace bajo
   * carga, que es lo que se siente en videollamadas o juegos.
   */
  latenciaCargaMs: number | null;
  bajadaMbps: number | null;
  subidaMbps: number | null;
  /** CU-35 Excepcion 2: alguna fase no pudo completarse. */
  parcial: boolean;
};

type RespuestaServidores = {
  targets?: string[];
};

function aMbps(bytes: number, ms: number): number {
  if (ms <= 0) return 0;
  return (bytes * 8) / (ms / 1000) / 1_000_000;
}

/**
 * Los targets llegan como `.../speedtest?c=cl&n=...`. Pedir el rango en el path
 * en vez de con el header `Range` evita el preflight de CORS: queda como una
 * peticion simple.
 */
function conRango(url: string, bytes: number): string {
  return url.replace("/speedtest?", `/speedtest/range/0-${bytes}?`);
}

/** Los servidores los pide el backend, no el navegador. Ver el comentario de
 * cabecera: `api.fast.com` no acepta nuestro origen. */
async function descubrirTargets(signal: AbortSignal): Promise<string[]> {
  const res = await fetch(`${API_URL}/diagnostico/servidores`, { signal });

  if (!res.ok) {
    throw new Error(`el servicio de medicion respondio ${res.status}`);
  }

  const data = (await res.json()) as RespuestaServidores;
  const targets = (data.targets ?? []).filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );

  if (targets.length === 0) {
    throw new Error("no hay servidores de medicion disponibles");
  }

  return targets;
}

/**
 * Mediana de varias idas y vueltas minimas. Mediana y no promedio para que un
 * pico aislado de la red no ensucie el resultado.
 */
async function medirLatencia(
  target: string,
  signal: AbortSignal,
  onAvance: (avance: number) => void,
): Promise<number> {
  const muestras: number[] = [];

  for (let i = 0; i < MUESTRAS_LATENCIA; i += 1) {
    onAvance(i / MUESTRAS_LATENCIA);
    const inicio = performance.now();
    await fetch(`${conRango(target, 0)}&_=${inicio}`, {
      signal,
      cache: "no-store",
    });
    muestras.push(performance.now() - inicio);
  }

  muestras.sort((a, b) => a - b);
  return Math.round(muestras[Math.floor(muestras.length / 2)]);
}

/**
 * Descarga en paralelo desde varios CDN y va contando bytes a medida que
 * llegan. Se usan varias conexiones porque una sola no satura un enlace de
 * fibra y la medicion saldria baja.
 */
async function medirBajada(
  targets: string[],
  signal: AbortSignal,
  onProgress: (mbps: number, avance: number) => void,
): Promise<{ mbps: number; latenciaCargaMs: number | null }> {
  const medidor = crearMedidor();

  const cortar = new AbortController();
  const senal = AbortSignal.any([signal, cortar.signal]);
  const temporizador = setTimeout(() => cortar.abort(), DURACION_BAJADA_MS);

  const registrar = (n: number) => {
    medidor.sumar(n);
    onProgress(medidor.tick(), medidor.transcurrido / DURACION_BAJADA_MS);
  };

  // Latencia bajo carga: se hacen pings minimos en paralelo a la descarga. Son
  // peticiones de 1 byte, asi que no le quitan ancho de banda a la medicion,
  // pero si sufren la cola del router igual que cualquier otro paquete.
  const pings: number[] = [];
  const medirPings = async () => {
    // Recien despues del calentamiento: antes el enlace todavia no esta
    // saturado y el numero no diria nada.
    await new Promise((r) => setTimeout(r, CALENTAMIENTO_MS));
    while (!senal.aborted) {
      const t0 = performance.now();
      try {
        await fetch(`${conRango(targets[0], 0)}&p=${t0}`, {
          signal: senal,
          cache: "no-store",
        });
        pings.push(performance.now() - t0);
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const descargas = targets.map(async (target) => {
    try {
      // Se repite hasta que se cumpla la ventana: en una conexion rapida los
      // 25 MB llegan en un par de segundos y la medicion quedaria dominada por
      // el arranque lento de TCP.
      while (!senal.aborted) {
        const res = await fetch(
          `${conRango(target, BYTES_POR_DESCARGA)}&_=${performance.now()}`,
          { signal: senal, cache: "no-store" },
        );
        const reader = res.body?.getReader();
        if (!reader) return;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          registrar(value.byteLength);
        }
      }
    } catch {
      // Abortar al cumplirse el tiempo es el caso normal, no un error.
    }
  });

  await Promise.all([...descargas, medirPings()]);
  clearTimeout(temporizador);

  if (medidor.total === 0) throw new Error("no se pudo medir la bajada");

  pings.sort((a, b) => a - b);
  const latenciaCargaMs =
    pings.length > 0 ? Math.round(pings[Math.floor(pings.length / 2)]) : null;

  return { mbps: medidor.resultado(), latenciaCargaMs };
}

/** Sube bloques aleatorios a los mismos CDN hasta cumplir el tiempo. */
async function medirSubida(
  targets: string[],
  signal: AbortSignal,
  onProgress: (mbps: number, avance: number) => void,
): Promise<number> {
  const bloque = new Uint8Array(BYTES_POR_SUBIDA);
  // Basta con aleatorizar el inicio: llenar 2 MB con crypto es caro y no
  // cambia lo que se mide, que es el tiempo de transferencia.
  crypto.getRandomValues(bloque.subarray(0, 65_536));

  const medidor = crearMedidor();

  const cortar = new AbortController();
  const senal = AbortSignal.any([signal, cortar.signal]);
  const temporizador = setTimeout(() => cortar.abort(), DURACION_SUBIDA_MS);

  const subidas = targets.map(async (target) => {
    try {
      while (!senal.aborted) {
        await fetch(target, {
          method: "POST",
          body: bloque,
          signal: senal,
          cache: "no-store",
        });
        medidor.sumar(bloque.byteLength);
        onProgress(medidor.tick(), medidor.transcurrido / DURACION_SUBIDA_MS);
      }
    } catch {
      // Igual que en la bajada: el abort por tiempo es el final esperado.
    }
  });

  await Promise.all(subidas);
  clearTimeout(temporizador);

  if (medidor.total === 0) throw new Error("no se pudo medir la subida");
  return medidor.resultado();
}

type OpcionesMedicion = {
  signal: AbortSignal;
  onProgress?: (progreso: ProgresoMedicion) => void;
};

/**
 * Corre la medicion completa. Si el descubrimiento falla lanza (CU-34
 * Excepcion 2). Si falla alguna fase intermedia devuelve lo que si se pudo
 * medir con `parcial: true` (CU-35 Excepcion 2).
 */
export async function medirVelocidad({
  signal,
  onProgress,
}: OpcionesMedicion): Promise<ResultadoVelocidad> {
  const avisar = (
    fase: FaseMedicion,
    avance: number,
    mbps?: number,
  ) => onProgress?.({ fase, mbps, progreso: progresoTotal(fase, avance) });

  avisar("descubriendo", 0);
  const targets = await descubrirTargets(signal);

  let latenciaMs: number | null = null;
  let latenciaCargaMs: number | null = null;
  let bajadaMbps: number | null = null;
  let subidaMbps: number | null = null;

  avisar("latencia", 0);
  try {
    latenciaMs = await medirLatencia(targets[0], signal, (a) =>
      avisar("latencia", a),
    );
  } catch {
    latenciaMs = null;
  }

  avisar("bajada", 0);
  try {
    const bajada = await medirBajada(targets, signal, (mbps, avance) =>
      avisar("bajada", avance, mbps),
    );
    bajadaMbps = bajada.mbps;
    latenciaCargaMs = bajada.latenciaCargaMs;
  } catch {
    bajadaMbps = null;
  }

  avisar("subida", 0);
  try {
    subidaMbps = await medirSubida(targets, signal, (mbps, avance) =>
      avisar("subida", avance, mbps),
    );
  } catch {
    subidaMbps = null;
  }

  return {
    latenciaMs,
    latenciaCargaMs,
    bajadaMbps,
    subidaMbps,
    parcial: latenciaMs === null || bajadaMbps === null || subidaMbps === null,
  };
}
