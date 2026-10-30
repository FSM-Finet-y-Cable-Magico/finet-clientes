import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import PortalDePagos from '@/app/pagar/_components/PortalDePagos';
import { WHATSAPP_URL } from '@/app/_lib/company';

const MEDIOS = [
  { id: 'webpay', nombre: 'Webpay', descripcion: 'Tarjetas', disponible: true },
];

/** Las facturas que G8 deja pagar (su §2 del 02-10). */
const FACTURAS = [
  { id_factura: 101, saldo: 14990, vence: '2026-10-15' },
  { id_factura: 102, saldo: 42990, vence: '2026-11-15' },
];

const TOKEN = 'tokendepruebatokendepruebatokendepruebatokendepruebatokendeprueb';
const URL_WEBPAY = 'https://webpay3gint.transbank.cl/webpayserver/initTransaction';

function respuesta(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) };
}

function resumen(saldo: number | null, facturas = saldo === null ? null : FACTURAS) {
  return respuesta({
    encontrado: true,
    cliente: { nombre: 'Ana Pérez', rut: 'XX.XXX.678-5' },
    saldo,
    facturas,
    medios: MEDIOS,
  });
}

async function elegir(user: ReturnType<typeof userEvent.setup>, factura: RegExp, medio: RegExp) {
  await user.click(await screen.findByRole('radio', { name: factura }));
  await user.click(screen.getByRole('radio', { name: medio }));
  await user.click(screen.getByRole('button', { name: /^pagar$/i }));
}

/** CU-42: portal de pagos, por factura. */
describe('PortalDePagos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('sin cuenta identificada, pide solo el RUT', async () => {
    const user = userEvent.setup();
    render(<PortalDePagos identificador={null} />);

    expect(screen.queryByText(/abonado/i)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('12.345.678-9'), '12345678-5');
    await user.click(screen.getByRole('button', { name: /ver mi deuda/i }));

    expect(push).toHaveBeenCalledWith('/pagar?rut=123456785');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('muestra de quién es la cuenta y las facturas que se pueden pagar', async () => {
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
    expect(screen.getByRole('radio', { name: /factura n° 101/i })).toBeInTheDocument();
    expect(screen.getByText('$14.990')).toBeInTheDocument();
    expect(screen.getByText('Vence el 15 de octubre de 2026')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /factura n° 102/i })).toBeInTheDocument();
  });

  it('se paga una factura entera: no hay opción de abonar', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(57980));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    await screen.findByText(/elige la factura/i);
    expect(screen.queryByText(/abon/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('pagar exige elegir una factura y un medio (RF-31)', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(57980));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    const pagar = await screen.findByRole('button', { name: /^pagar$/i });
    expect(pagar).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /webpay/i }));
    expect(pagar).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /factura n° 102/i }));
    expect(pagar).toBeEnabled();
    expect(screen.getAllByText('$42.990')).toHaveLength(2);
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
    await elegir(user, /factura n° 101/i, /webpay/i);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Webpay no puede utilizarse temporalmente',
    );
  });

  it('el navegador manda la factura, no el monto: lo que se cobra lo dice G8', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(resumen(57980))
      .mockResolvedValueOnce(respuesta({ message: 'x' }, false, 503));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);
    await elegir(user, /factura n° 101/i, /webpay/i);

    await waitFor(() => {
      const [url, init] = (global.fetch as jest.Mock).mock.calls[1];
      expect(url).toContain('/pagos/iniciar');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        rut: '123456785',
        id_factura: 101,
        medio: 'webpay',
      });
    });
  });

  it('con la transacción creada, lleva al cliente a Webpay por POST con token_ws', async () => {
    const user = userEvent.setup();
    const submit = jest
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => {});
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(resumen(57980))
      .mockResolvedValueOnce(respuesta({ url: URL_WEBPAY, token: TOKEN }));

    const { container } = render(<PortalDePagos identificador={{ rut: '123456785' }} />);
    await elegir(user, /factura n° 101/i, /webpay/i);

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('method', 'post');
    expect(form).toHaveAttribute('action', URL_WEBPAY);
    expect(container.querySelector('input[name="token_ws"]')).toHaveValue(TOKEN);
    expect(screen.getByText(/te estamos llevando a webpay/i)).toBeInTheDocument();
    submit.mockRestore();
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
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(0, []));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    expect(await screen.findByText(/estás al día/i)).toBeInTheDocument();
  });

  it('con deuda, pero ninguna factura que G8 deje pagar: deriva a WhatsApp', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(resumen(57980, []));

    render(<PortalDePagos identificador={{ rut: '123456785' }} />);

    expect(
      await screen.findByText(/tu deuda no se puede pagar en línea/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      WHATSAPP_URL,
    );
    expect(screen.queryByRole('button', { name: /^pagar$/i })).not.toBeInTheDocument();
  });

  it('cuenta que no existe, o enlace alterado', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      respuesta({ encontrado: false, cliente: null, saldo: null, facturas: null, medios: [] }),
    );

    render(<PortalDePagos identificador={{ t: 'falso' }} />);

    expect(
      await screen.findByText(/no encontramos una cuenta/i),
    ).toBeInTheDocument();
  });
});
