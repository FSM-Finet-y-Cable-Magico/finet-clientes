import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import PortalDePagos from '@/app/pagar/_components/PortalDePagos';

const MEDIOS = [
  { id: 'webpay', nombre: 'Webpay', descripcion: 'Tarjetas', disponible: false },
  { id: 'mercadopago', nombre: 'Mercado Pago', descripcion: 'Cuenta MP', disponible: false },
];

function respuesta(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) };
}

function resumen(saldo: number | null) {
  return respuesta({
    encontrado: true,
    cliente: { nombre: 'Ana Pérez', rut: 'XX.XXX.678-5', codigo_abonado: null },
    saldo,
    medios: MEDIOS,
  });
}

/** CU-42 / CU-43: portal de pagos. */
describe('PortalDePagos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('sin cuenta identificada, pide el RUT o el código de abonado', async () => {
    const user = userEvent.setup();
    render(<PortalDePagos identificador={null} />);

    await user.type(screen.getByPlaceholderText('12.345.678-9'), '12345678-5');
    await user.click(screen.getByRole('button', { name: /ver mi deuda/i }));

    expect(push).toHaveBeenCalledWith('/pagar?rut=123456785');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('también por código de abonado', async () => {
    const user = userEvent.setup();
    render(<PortalDePagos identificador={null} />);

    await user.click(screen.getByRole('button', { name: /código de abonado/i }));
    await user.type(screen.getByLabelText(/código de abonado/i), '100');
    await user.click(screen.getByRole('button', { name: /ver mi deuda/i }));

    expect(push).toHaveBeenCalledWith('/pagar?abonado=100');
  });

  it('muestra el resumen: de quién es la cuenta y el total a pagar', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(57980));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    await waitFor(() => {
      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pagos/resumen?rut=123456785'),
      expect.any(Object),
    );
    expect(screen.getByText(/RUT XX\.XXX\.678-5/)).toBeInTheDocument();
    expect(screen.getAllByText('$57.980')).toHaveLength(2);
  });

  it('se paga el total: no hay opción de abonar', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(57980));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    await screen.findByText(/saldo total/i);
    expect(screen.queryByText(/abon/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('ofrece Webpay y Mercado Pago (RF-31), y pagar exige elegir uno', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(57980));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    expect(await screen.findByRole('radio', { name: /webpay/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /mercado pago/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pagar$/i })).toBeDisabled();
  });

  it('Excepción 1: si el medio no está disponible, lo informa', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(resumen(57980))
      .mockResolvedValueOnce(
        respuesta(
          { message: 'Webpay no puede utilizarse temporalmente. Intenta más tarde.' },
          false,
          503,
        ),
      );

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    await user.click(await screen.findByRole('radio', { name: /webpay/i }));
    await user.click(screen.getByRole('button', { name: /^pagar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Webpay no puede utilizarse temporalmente',
    );
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/pagos/iniciar'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rut: '123456785', medio: 'webpay' }),
      }),
    );
  });

  it('el navegador no manda el monto: el total lo decide el backend con el saldo de G8', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(resumen(57980))
      .mockResolvedValueOnce(respuesta({ message: 'x' }, false, 503));

    render(<PortalDePagos identificador={{ abonado: '100' }} />);

    await user.click(await screen.findByRole('radio', { name: /mercado pago/i }));
    await user.click(screen.getByRole('button', { name: /^pagar$/i }));

    await waitFor(() => {
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      expect(body).toEqual({ abonado: '100', medio: 'mercadopago' });
    });
  });

  it('sin el saldo de G8 no hay deuda identificada: no ofrece pagar', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(null));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    expect(
      await screen.findByText(/no pudimos obtener tu deuda/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pagar$/i })).not.toBeInTheDocument();
  });

  it('sin deuda: "Estás al día"', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(0));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    expect(await screen.findByText(/estás al día/i)).toBeInTheDocument();
  });

  it('cuenta que no existe, o enlace alterado', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta({ encontrado: false, cliente: null, saldo: null, medios: [] }),
    );

    render(<PortalDePagos identificador={{ t: 'falso' }} />);

    expect(
      await screen.findByText(/no encontramos una cuenta/i),
    ).toBeInTheDocument();
  });
});
