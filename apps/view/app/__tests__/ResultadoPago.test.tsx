import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import ResultadoPago from '@/app/[marca]/pagar/_components/ResultadoPago';
import { WHATSAPP_URL } from '@/app/_lib/company';

process.env.TZ = 'America/Santiago';

const TOKEN = 'tokendepruebatokendepruebatokendepruebatokendepruebatokendeprueb';

/** Lo que el backend responde de Transbank para un pago aprobado. */
const APROBADO = {
  estado: 'aprobado',
  monto: 14990,
  fecha: '2026-10-29T16:41:21.063Z',
  codigo_autorizacion: '1213',
  orden: 'F101-mh2k9x1a2b3c',
  id_factura: 101,
};

function respuesta(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) };
}

/**
 * CU-42: la pantalla adonde vuelve el cliente desde Webpay. El estado lo dice
 * Transbank (a través del backend), no la URL.
 */
describe('ResultadoPago', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('aprobado: el monto, la factura y los datos del pago', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuesta(APROBADO));

    render(<ResultadoPago resultado="aprobado" token={TOKEN} />);

    expect(await screen.findByText('Pago aprobado')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/pagos/webpay/resultado?token_ws=${TOKEN}`),
      expect.any(Object),
    );
    expect(screen.getByText(/pagaste \$14\.990 de la factura n° 101/i)).toBeInTheDocument();
    expect(screen.getByText('1213')).toBeInTheDocument();
    expect(screen.getByText('29/10/2026')).toBeInTheDocument();
    expect(screen.getByText('F101-mh2k9x1a2b3c')).toBeInTheDocument();
  });

  it('aprobado pero sin registrar en G8: lo dice y ofrece WhatsApp', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(respuesta(APROBADO));

    render(<ResultadoPago resultado="pendiente" token={TOKEN} />);

    expect(await screen.findByText('Tu pago fue aprobado')).toBeInTheDocument();
    expect(screen.getByText(/todavía no se refleja en tu cuenta/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      WHATSAPP_URL,
    );
  });

  it('anulado porque G8 no lo pudo aplicar', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta({ ...APROBADO, estado: 'anulado', codigo_autorizacion: null }),
    );

    render(<ResultadoPago resultado="anulado" token={TOKEN} />);

    expect(await screen.findByText('No pudimos aplicar tu pago')).toBeInTheDocument();
    expect(screen.getByText(/lo anulamos en webpay/i)).toBeInTheDocument();
  });

  it('Excepción 3: "el pago no fue aprobado"', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta({ ...APROBADO, estado: 'rechazado', codigo_autorizacion: null }),
    );

    render(<ResultadoPago resultado="rechazado" token={TOKEN} />);

    expect(await screen.findByText('El pago no fue aprobado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al portal de pagos/i })).toHaveAttribute(
      'href',
      '/pagar',
    );
  });

  it('manda lo que dice Transbank, no la URL: un "aprobado" falso no se muestra', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta({ ...APROBADO, estado: 'rechazado', codigo_autorizacion: null }),
    );

    render(<ResultadoPago resultado="aprobado" token={TOKEN} />);

    expect(await screen.findByText('El pago no fue aprobado')).toBeInTheDocument();
    expect(screen.queryByText('Pago aprobado')).not.toBeInTheDocument();
  });

  it('Excepción 2: el cliente canceló', () => {
    render(<ResultadoPago resultado="cancelado" token={null} />);

    expect(screen.getByText('Pago cancelado')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sin token no se puede mostrar un pago aprobado', () => {
    render(<ResultadoPago resultado="aprobado" token={null} />);

    expect(
      screen.getByText('No pudimos confirmar el resultado de tu pago'),
    ).toBeInTheDocument();
  });

  it('si no se puede consultar a Transbank: error, con WhatsApp', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta({ message: 'No pudimos consultar el resultado' }, false, 503),
    );

    render(<ResultadoPago resultado="aprobado" token={TOKEN} />);

    expect(
      await screen.findByText('No pudimos confirmar el resultado de tu pago'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toBeInTheDocument();
  });
});
