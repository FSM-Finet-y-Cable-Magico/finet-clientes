import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AsistenteWidget from '@/app/_components/asistente/AsistenteWidget';

const respuestaOk = (respuesta: string) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ respuesta }),
});

const respuestaError = (status: number) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ message: 'Error' }),
});

describe('AsistenteWidget (CU-65)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    global.fetch = jest.fn();
  });

  it('muestra solo el botón flotante hasta que se abre', async () => {
    const user = userEvent.setup();
    render(<AsistenteWidget />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));

    expect(screen.getByRole('dialog', { name: /asistente virtual/i })).toBeInTheDocument();
    expect(screen.getByText(/soy el asistente virtual de finet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/escribe tu mensaje/i)).toHaveFocus();
  });

  it('envía el mensaje al backend y muestra la respuesta', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuestaOk('Tenemos planes desde 200 Mbps.'),
    );
    render(<AsistenteWidget />);

    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));
    await user.type(screen.getByLabelText(/escribe tu mensaje/i), '¿Qué planes tienen?');
    await user.click(screen.getByRole('button', { name: /enviar mensaje/i }));

    expect(await screen.findByText('Tenemos planes desde 200 Mbps.')).toBeInTheDocument();
    expect(screen.getByText('¿Qué planes tienen?')).toBeInTheDocument();

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/asistente/mensajes');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.mensaje).toBe('¿Qué planes tienen?');
    expect(body.id_sesion).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('mantiene la misma sesión entre mensajes', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respuestaOk('uno'))
      .mockResolvedValueOnce(respuestaOk('dos'));
    render(<AsistenteWidget />);

    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));
    const input = screen.getByLabelText(/escribe tu mensaje/i);
    await user.type(input, 'hola{Enter}');
    await screen.findByText('uno');
    await user.type(input, 'otra{Enter}');
    await screen.findByText('dos');

    const sesiones = (global.fetch as jest.Mock).mock.calls.map(
      ([, init]) => JSON.parse(init.body).id_sesion,
    );
    expect(sesiones[0]).toBe(sesiones[1]);
  });

  it('si falla, devuelve el mensaje al input y avisa', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuestaError(503));
    render(<AsistenteWidget />);

    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));
    const input = screen.getByLabelText(/escribe tu mensaje/i);
    await user.type(input, 'hola{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(/no está disponible/i);
    expect(input).toHaveValue('hola');
  });

  it('avisa cuando se superó el límite de mensajes', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuestaError(429));
    render(<AsistenteWidget />);

    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));
    await user.type(screen.getByLabelText(/escribe tu mensaje/i), 'hola{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(/muy seguido/i);
  });

  it('restaura la conversación de la pestaña al reabrir', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      'finet-asistente',
      JSON.stringify({
        idSesion: '3f6c8a52-7d1e-4b9a-9c2f-5e8d1a0b7c64',
        mensajes: [
          { rol: 'usuario', texto: 'pregunta anterior' },
          { rol: 'asistente', texto: 'respuesta anterior' },
        ],
      }),
    );
    render(<AsistenteWidget />);

    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));

    expect(screen.getByText('pregunta anterior')).toBeInTheDocument();
    expect(screen.getByText('respuesta anterior')).toBeInTheDocument();
  });

  it('se cierra con Escape y devuelve el foco al botón', async () => {
    const user = userEvent.setup();
    render(<AsistenteWidget />);

    await user.click(screen.getByRole('button', { name: /abrir asistente/i }));
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /abrir asistente/i })).toHaveFocus();
  });
});
