import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const medirVelocidad = jest.fn();
jest.mock('@/app/_lib/fast-speedtest', () => ({
  medirVelocidad: (...args: unknown[]) => medirVelocidad(...args),
}));

import FastSpeedTest from '@/app/_components/FastSpeedTest';

/**
 * CU-36: la herramienta de evaluación de red (Fast.com) a la que se entra desde
 * la página principal.
 */
describe('FastSpeedTest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('se carga lista para iniciar la prueba', () => {
    render(<FastSpeedTest />);

    expect(
      screen.getByRole('button', { name: 'Iniciar prueba' }),
    ).toBeInTheDocument();
  });

  it('Excepciones 1 y 2: si Fast.com no responde, lo informa y deja reintentar', async () => {
    medirVelocidad.mockRejectedValue(new Error('sin conexión'));
    const user = userEvent.setup();
    render(<FastSpeedTest />);

    await user.click(screen.getByRole('button', { name: 'Iniciar prueba' }));

    expect(
      await screen.findByText('La herramienta de medición no está disponible'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Revisa tu conexión e inténtalo nuevamente/),
    ).toBeInTheDocument();

    medirVelocidad.mockClear();
    await user.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(medirVelocidad).toHaveBeenCalledTimes(1);
  });
});
