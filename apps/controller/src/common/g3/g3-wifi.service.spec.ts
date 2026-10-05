import {
  jest,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import {
  ErrorClaveWifiG3,
  G3WifiService,
  type EnvioClaveWifi,
} from './g3-wifi.service.js';

// Un par de llaves de prueba del mismo tamaño que el de G3, para comprobar que lo
// que sale se abre con la privada y mide lo que G3 dice (512 caracteres).
let llavePrivada: string;
let llavePublicaBase64: string;

const API_KEY = 'a'.repeat(64);
const URL_G3 = 'https://g3.test/api/integraciones/contrasena-wifi';

const ENVIO: EnvioClaveWifi = {
  clave: 'MiClaveNueva#2026',
  idTicket: '77',
  idContrato: 100,
  idEmpresa: 1,
  requestId: '39e53001-4a60-4bd2-9ee6-c6ef75dc3029',
  traceId: '0b7c2f6e-2d0a-4f3c-9a51-6f1d2b8e4c10',
};

const RESPUESTA_201 = {
  success: true,
  data: {
    duplicado: false,
    request_id: ENVIO.requestId,
    id_solicitud: 2,
    estado: 'PENDIENTE',
    fecha: '2026-10-01T21:11:14.370Z',
  },
};

const respuesta = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Lo que G3 responde cuando rechaza algo: el formato estándar de NestJS. */
const rechazo = (status: number, message: string) =>
  respuesta(status, { message, error: 'X', statusCode: status });

/**
 * El canal directo a G3 del acuerdo v2.0 (§6.4, pasos 4 a 7), con el contrato
 * que G3 publicó el 01-10. Cada respuesta de los tests es la que G3 dio en la
 * prueba real contra su endpoint.
 */
describe('G3WifiService', () => {
  let service: G3WifiService;
  let config: Record<string, string | undefined>;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeAll(() => {
    const par = generateKeyPairSync('rsa', {
      modulusLength: 3072,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    llavePrivada = par.privateKey;
    llavePublicaBase64 = Buffer.from(par.publicKey).toString('base64');
  });

  beforeEach(() => {
    config = {
      G3_API_URL: 'https://g3.test/',
      G3_API_KEY: API_KEY,
      G3_WIFI_PUBLIC_KEY: llavePublicaBase64,
    };
    service = new G3WifiService({
      get: (clave: string) => config[clave],
    } as unknown as ConfigService);
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const bodyEnviado = (llamada = 0) =>
    JSON.parse(fetchMock.mock.calls[llamada][1]!.body as string) as Record<
      string,
      unknown
    >;

  it('201: la solicitud queda registrada en G3', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(201, RESPUESTA_201));

    const r = await service.enviarClaveWifi(ENVIO);

    expect(r).toEqual({
      idSolicitud: 2,
      estado: 'PENDIENTE',
      fecha: '2026-10-01T21:11:14.370Z',
      duplicado: false,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL_G3);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['X-API-KEY']).toBe(
      API_KEY,
    );
  });

  it('manda lo del contrato: ids como número, el ticket como string y los UUID', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(201, RESPUESTA_201));

    await service.enviarClaveWifi(ENVIO);

    expect(bodyEnviado()).toEqual({
      ciphertext: expect.any(String),
      id_ticket: '77',
      id_contrato: 100,
      id_empresa: 1,
      request_id: ENVIO.requestId,
      trace_id: ENVIO.traceId,
    });
  });

  it('la clave va cifrada con la llave de G3: 512 caracteres que solo abre su privada', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(201, RESPUESTA_201));

    await service.enviarClaveWifi(ENVIO);

    const { ciphertext } = bodyEnviado() as { ciphertext: string };
    expect(ciphertext).toHaveLength(512);
    expect(fetchMock.mock.calls[0][1]!.body).not.toContain(ENVIO.clave);
    const abierta = privateDecrypt(
      {
        key: llavePrivada,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(ciphertext, 'base64'),
    ).toString('utf8');
    expect(abierta).toBe(ENVIO.clave);
  });

  it('200 con duplicado: G3 ya la tenía y no la reaplica', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(200, {
        ...RESPUESTA_201,
        data: { ...RESPUESTA_201.data, duplicado: true },
      }),
    );

    const r = await service.enviarClaveWifi(ENVIO);

    expect(r.duplicado).toBe(true);
  });

  // ─── Reintentos (acuerdo §6.6, contrato G3 punto 3.6) ─────────────────────

  it('timeout: reintenta con el mismo body exacto, sin recifrar', async () => {
    fetchMock
      .mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
      .mockResolvedValueOnce(respuesta(201, RESPUESTA_201));

    await service.enviarClaveWifi(ENVIO);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Mismo ciphertext y mismo request_id: si no, G3 respondería 409.
    expect(fetchMock.mock.calls[1][1]!.body).toBe(
      fetchMock.mock.calls[0][1]!.body,
    );
  });

  it('5xx: reintenta una vez con el mismo body', async () => {
    fetchMock
      .mockResolvedValueOnce(rechazo(502, 'Bad Gateway'))
      .mockResolvedValueOnce(respuesta(201, RESPUESTA_201));

    await service.enviarClaveWifi(ENVIO);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]!.body).toBe(
      fetchMock.mock.calls[0][1]!.body,
    );
  });

  it('si el reintento también falla, falla: nunca se simula un registro', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.enviarClaveWifi(ENVIO)).rejects.toBeInstanceOf(
      ErrorClaveWifiG3,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, 'ciphertext: no se pudo descifrar con la llave publica vigente'],
    [401, 'Falta el header X-API-KEY'],
    [403, 'id_empresa fuera del alcance de la clave de API'],
    [409, `request_id ${ENVIO.requestId} ya existe con otro contenido`],
  ])('%i: se informa y no se reintenta', async (status, message) => {
    fetchMock.mockResolvedValueOnce(rechazo(status, message));

    const error = await service.enviarClaveWifi(ENVIO).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorClaveWifiG3);
    expect((error as ErrorClaveWifiG3).status).toBe(status);
    expect((error as ErrorClaveWifiG3).message).toContain(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un 201 sin los datos del contrato no se toma como registrado', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(201, { success: true }));

    await expect(service.enviarClaveWifi(ENVIO)).rejects.toBeInstanceOf(
      ErrorClaveWifiG3,
    );
  });

  // ─── Configuración y secretos (acuerdo §12) ───────────────────────────────

  it.each(['G3_API_URL', 'G3_API_KEY', 'G3_WIFI_PUBLIC_KEY'])(
    'sin %s no se envía nada',
    async (variable) => {
      config[variable] = undefined;

      await expect(service.enviarClaveWifi(ENVIO)).rejects.toThrow(
        `Falta configurar ${variable}`,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('una llave que no es PEM no se usa', async () => {
    config.G3_WIFI_PUBLIC_KEY =
      Buffer.from('no es una llave').toString('base64');

    await expect(service.enviarClaveWifi(ENVIO)).rejects.toThrow(
      'no es un PEM',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ningún error trae la clave, el ciphertext ni la clave de API', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(rechazo(400, 'ciphertext: no se pudo descifrar'));

    const error = (await service
      .enviarClaveWifi(ENVIO)
      .catch((e: unknown) => e)) as Error;

    const { ciphertext } = bodyEnviado() as { ciphertext: string };
    expect(error.message).not.toContain(ENVIO.clave);
    expect(error.message).not.toContain(ciphertext);
    expect(error.message).not.toContain(API_KEY);
  });
});
