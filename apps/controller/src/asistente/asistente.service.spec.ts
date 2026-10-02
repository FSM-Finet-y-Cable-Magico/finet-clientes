import {
  jest,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsistenteService } from './asistente.service.js';

const SESION = '3f6c8a52-7d1e-4b9a-9c2f-5e8d1a0b7c64';

const respuestaFetch = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

describe('AsistenteService', () => {
  let env: Record<string, string | undefined>;
  let service: AsistenteService;
  let fetchMock: jest.Mock<typeof fetch>;

  beforeEach(() => {
    env = {
      CHATBOT_URL: 'http://chatbot.test/',
      CHATBOT_API_KEY: 'clave-chatbot',
    };
    const config = { get: (key: string) => env[key] } as ConfigService;
    service = new AsistenteService(config);

    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CU-65: responder', () => {
    it('reenvia el mensaje al chatbot con la API key y devuelve su respuesta', async () => {
      fetchMock.mockResolvedValueOnce(
        respuestaFetch(201, { content: 'Hola, ¿en que te ayudo?' }),
      );

      const result = await service.responder({
        id_sesion: SESION,
        mensaje: 'hola',
      });

      expect(result).toEqual({
        respuesta: 'Hola, ¿en que te ayudo?',
        derivado: false,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://chatbot.test/web/messages');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({ 'X-Api-Key': 'clave-chatbot' });
      expect(JSON.parse(init?.body as string)).toEqual({
        sessionId: SESION,
        content: 'hola',
      });
    });

    it('responde 503 sin llamar al chatbot si falta la configuracion', async () => {
      env.CHATBOT_API_KEY = '';

      await expect(
        service.responder({ id_sesion: SESION, mensaje: 'hola' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('responde 503 si el chatbot responde con error', async () => {
      fetchMock.mockResolvedValueOnce(respuestaFetch(503, {}));

      await expect(
        service.responder({ id_sesion: SESION, mensaje: 'hola' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('responde 503 si el chatbot no esta alcanzable', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(
        service.responder({ id_sesion: SESION, mensaje: 'hola' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('avisa cuando el chatbot deriva la conversacion', async () => {
      fetchMock.mockResolvedValueOnce(
        respuestaFetch(201, {
          content: 'Escribenos por WhatsApp.',
          handedOff: true,
        }),
      );

      await expect(
        service.responder({ id_sesion: SESION, mensaje: 'quiero una persona' }),
      ).resolves.toEqual({
        respuesta: 'Escribenos por WhatsApp.',
        derivado: true,
      });
    });

    it('acepta una conversacion derivada que ya no responde', async () => {
      fetchMock.mockResolvedValueOnce(
        respuestaFetch(201, { content: null, handedOff: true }),
      );

      await expect(
        service.responder({ id_sesion: SESION, mensaje: 'hola' }),
      ).resolves.toEqual({ respuesta: null, derivado: true });
    });

    it('responde 503 si el chatbot responde sin contenido', async () => {
      fetchMock.mockResolvedValueOnce(respuestaFetch(201, { content: '' }));

      await expect(
        service.responder({ id_sesion: SESION, mensaje: 'hola' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
