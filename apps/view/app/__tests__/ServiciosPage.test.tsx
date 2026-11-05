import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiciosPage from '@/app/portal/servicios/page';

// Las fechas de calendario (@db.Date) llegan como medianoche UTC. Con la hora de
// Chile, si no se formatean en UTC, se ven un día antes: se fija para que el test
// lo detecte en cualquier máquina.
process.env.TZ = 'America/Santiago';

describe('ServiciosPage (CU-25/CU-26)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('muestra estado vacío cuando no hay contratos', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<ServiciosPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/aún no tienes servicios contratados/i),
      ).toBeInTheDocument();
    });
  });

  it('muestra el plan, velocidad, precio y estado de un contrato único (CU-25)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id_contrato: 100,
            estado: 'activo',
            fecha_inicio: '2025-01-15T00:00:00.000Z',
            dia_vencimiento: 10,
            plan: {
              id_plan: 5,
              nombre_comercial: 'Fibra 600 Megas',
              tipo_plan: 'fibra',
              velocidad_mbps: 600,
              precio_mensual: 19990,
            },
          },
        ]),
    });

    render(<ServiciosPage />);

    await waitFor(() => {
      expect(screen.getByText('Fibra 600 Megas')).toBeInTheDocument();
    });

    expect(screen.getByText('600 Mbps')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText(/vence el día 10 de cada mes/i)).toBeInTheDocument();
    expect(screen.getByText('Inicio: 15 de enero de 2025')).toBeInTheDocument();
  });

  it('muestra múltiples contratos y contempla contrato sin plan asociado (CU-26)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id_contrato: 100,
            estado: 'suspendido',
            fecha_inicio: '2025-06-01T00:00:00.000Z',
            dia_vencimiento: 5,
            plan: null,
          },
          {
            id_contrato: 101,
            estado: 'cortado',
            fecha_inicio: '2024-01-01T00:00:00.000Z',
            dia_vencimiento: 20,
            plan: {
              id_plan: 2,
              nombre_comercial: 'Duo Hogar',
              tipo_plan: 'duo',
              velocidad_mbps: null,
              precio_mensual: 24990,
            },
          },
        ]),
    });

    render(<ServiciosPage />);

    await waitFor(() => {
      expect(screen.getByText('Duo Hogar')).toBeInTheDocument();
    });

    expect(screen.getByText(/sin plan asociado/i)).toBeInTheDocument();
    expect(screen.getByText('Suspendido')).toBeInTheDocument();
    expect(screen.getByText('Cortado')).toBeInTheDocument();
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
        json: () => Promise.resolve([]),
      });

    render(<ServiciosPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/no se pudo cargar tus servicios/i),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/aún no tienes servicios contratados/i),
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
