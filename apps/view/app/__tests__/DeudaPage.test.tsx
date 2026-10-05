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
});
