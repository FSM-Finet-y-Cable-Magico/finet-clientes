import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeudaLookupForm from '@/app/components/DeudaLookupForm';

describe('DeudaLookupForm (CU-39/CU-40)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renderiza campos de búsqueda por RUT y selector de modo', () => {
    render(<DeudaLookupForm />);
    expect(screen.getByPlaceholderText('12.345.678-9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /por rut/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /por código abonado/i })).toBeInTheDocument();
  });

  it('consulta por RUT y muestra resultado (CU-39)', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        encontrado: true,
        cliente: { nombre_completo: 'Juan Pérez', rut: '12345678-5', codigo_abonado: null },
        tiene_deuda: true,
        saldo_total: 39980,
        facturas: [
          { id_factura: 1, periodo: 'Mayo 2026', monto: 19990, fecha_limite_pago: '2026-05-10', estado: 'pendiente', dias_vencida: null, dias_para_vencer: 15 },
          { id_factura: 2, periodo: 'Abril 2026', monto: 19990, fecha_limite_pago: '2026-04-10', estado: 'vencida', dias_vencida: 45, dias_para_vencer: null },
        ],
        planes: [
          { nombre_comercial: 'Plan 200 Mbps', tipo_plan: 'FIBRA', velocidad_mbps: 200, precio_mensual: 24990 },
        ],
        detalle_disponible: true,
        informacion_completa: true,
      }),
    });

    render(<DeudaLookupForm />);

    await user.type(screen.getByPlaceholderText('12.345.678-9'), '12345678-5');
    await user.click(screen.getByRole('button', { name: /consultar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/deuda-publica/rut?rut='),
        expect.any(Object),
      );
      expect(screen.getByText(/juan pérez/i)).toBeInTheDocument();
    });

    // Detalle del plan y "Pagar ahora", que lleva a /pagar con el mismo RUT (CU-42/43)
    expect(screen.getByText(/plan 200 mbps/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pagar ahora/i })).toHaveAttribute(
      'href',
      '/pagar?rut=123456785',
    );
  });

  it('cambia a modo código de abonado y consulta (CU-40)', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        encontrado: true,
        cliente: { nombre_completo: 'María López', rut: '98765432-1', codigo_abonado: 100 },
        tiene_deuda: false,
        saldo_total: 0,
        facturas: [],
        planes: [],
        detalle_disponible: true,
        informacion_completa: true,
      }),
    });

    render(<DeudaLookupForm />);

    await user.click(screen.getByRole('button', { name: /por código abonado/i }));
    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.click(screen.getByRole('button', { name: /consultar/i }));

    await waitFor(() => {
      expect(screen.getByText(/maría lópez/i)).toBeInTheDocument();
    });
  });

  it('muestra "no encontrado" si el RUT no existe (CU-39 Excepción 3)', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        encontrado: false,
        cliente: null,
        tiene_deuda: false,
        saldo_total: 0,
        facturas: [],
      }),
    });

    render(<DeudaLookupForm />);

    await user.type(screen.getByPlaceholderText('12.345.678-9'), '99999999-9');
    await user.click(screen.getByRole('button', { name: /consultar/i }));

    await waitFor(() => {
      expect(screen.getByText(/no se encontraron/i)).toBeInTheDocument();
    });
  });
});
