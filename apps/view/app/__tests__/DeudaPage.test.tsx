import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import DeudaPage from '@/app/portal/deuda/page';

describe('DeudaPage (CU-27/CU-28/CU-41)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('muestra "Estás al día" cuando no hay deuda (CU-27)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tiene_deuda: false,
          saldo_total: 0,
          saldo_confirmado: true,
          facturas_pendientes: [],
        }),
    });

    render(<DeudaPage />);

    await waitFor(() => {
      expect(screen.getByText(/estás al día/i)).toBeInTheDocument();
    });
  });

  it('muestra saldo pendiente, detalle de facturas y botón "Pagar ahora" (CU-28/CU-41)', async () => {
    // La sección de pagos anteriores (CU-52) también pide datos al montarse.
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ comprobante_disponible: false, pagos: [] }),
      }),
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tiene_deuda: true,
          saldo_total: 39980,
          saldo_confirmado: true,
          facturas_pendientes: [
            {
              id_factura: 201,
              periodo: 'Mayo 2026',
              monto: 19990,
              fecha_limite_pago: '2026-05-10',
              estado: 'pendiente',
              dias_vencida: null,
            },
            {
              id_factura: 202,
              periodo: 'Abril 2026',
              monto: 19990,
              fecha_limite_pago: '2026-04-10',
              estado: 'vencida',
              dias_vencida: 52,
            },
          ],
        }),
    });

    render(<DeudaPage />);

    await waitFor(() => {
      expect(screen.getByText(/\$\s*39\.?980/)).toBeInTheDocument();
    });

    expect(screen.getByText('Mayo 2026')).toBeInTheDocument();
    expect(screen.getByText('Abril 2026')).toBeInTheDocument();
    expect(screen.getByText(/hace 52 días/i)).toBeInTheDocument();
    await screen.findByText(/aún no registras pagos/i);

    // CU-42/43: "Pagar ahora" pide el enlace firmado y lleva a /pagar
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enlace: '/pagar?t=p.1.a.b.c' }),
    });
    await userEvent.setup().click(
      screen.getByRole('button', { name: /pagar ahora/i }),
    );
    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/portal/enlace-pago'),
        expect.any(Object),
      );
      expect(push).toHaveBeenCalledWith('/pagar?t=p.1.a.b.c');
    });
  });

  it('muestra aviso cuando el saldo no está confirmado (CU-27 Excepción 3)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tiene_deuda: false,
          saldo_total: 0,
          saldo_confirmado: false,
          facturas_pendientes: [],
        }),
    });

    render(<DeudaPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/no pudimos confirmar tu saldo/i),
      ).toBeInTheDocument();
    });
  });

  it('muestra error y permite reintentar si falla la carga', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Error interno' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tiene_deuda: false,
            saldo_total: 0,
            saldo_confirmado: true,
            facturas_pendientes: [],
          }),
      });

    render(<DeudaPage />);

    await waitFor(() => {
      expect(screen.getByText(/no se pudo cargar tu deuda/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => {
      expect(screen.getByText(/estás al día/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // CU-52: pagos anteriores y su comprobante.
  describe('Pagos anteriores (CU-52)', () => {
    const SIN_DEUDA = {
      tiene_deuda: false,
      saldo_total: 0,
      saldo_confirmado: true,
      facturas_pendientes: [],
    };

    function responder(pagos: unknown) {
      (global.fetch as jest.Mock).mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(url.includes('/portal/pagos') ? pagos : SIN_DEUDA),
        }),
      );
    }

    it('lista los pagos con los formatos del Documento 0 y el comprobante deshabilitado mientras falta G8', async () => {
      responder({
        comprobante_disponible: false,
        pagos: [
          {
            id_pago: 9,
            // 22:30 del 7 de abril en Chile: en UTC ya es el 8
            fecha_pago: '2026-04-08T02:30:00.000Z',
            periodo: 'Abril 2026',
            monto: 18990,
            pasarela: 'WEBPAY',
          },
        ],
      });

      render(<DeudaPage />);

      await screen.findAllByText('07/04/2026');
      const seccion = screen.getByRole('region', { name: /pagos anteriores/i });
      expect(seccion).toHaveTextContent('07/04/2026');
      expect(seccion).toHaveTextContent('Abril 2026');
      expect(seccion).toHaveTextContent(/\$\s*18\.990/);
      expect(seccion).toHaveTextContent('WEBPAY');
      expect(
        screen.getByText(/todavía no se pueden descargar/i),
      ).toBeInTheDocument();
      for (const boton of screen.getAllByRole('button', {
        name: /descargar comprobante del pago del 07\/04\/2026/i,
      })) {
        expect(boton).toBeDisabled();
      }
    });

    it('sin pagos muestra el estado vacío', async () => {
      responder({ comprobante_disponible: false, pagos: [] });

      render(<DeudaPage />);

      expect(
        await screen.findByText(/aún no registras pagos/i),
      ).toBeInTheDocument();
    });

    it('con el endpoint de G8 listo, el comprobante se descarga desde nuestro backend', async () => {
      responder({
        comprobante_disponible: true,
        pagos: [
          {
            id_pago: 9,
            fecha_pago: '2026-04-08T02:30:00.000Z',
            periodo: 'Abril 2026',
            monto: 18990,
            pasarela: 'WEBPAY',
          },
        ],
      });

      render(<DeudaPage />);

      const enlaces = await screen.findAllByRole('link', {
        name: /descargar comprobante/i,
      });
      expect(enlaces[0]).toHaveAttribute(
        'href',
        expect.stringContaining('/portal/pagos/9/comprobante'),
      );
    });
  });
});
