import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/app/utils/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import UpdateTelefonoForm from '@/app/components/UpdateTelefonoForm';
import { api } from '@/app/utils/api';

describe('UpdateTelefonoForm (CU-08)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza campos de contraseña actual y nuevo teléfono', () => {
    render(<UpdateTelefonoForm />);
    expect(screen.getByLabelText(/contraseña actual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nuevo teléfono/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar teléfono/i })).toBeInTheDocument();
  });

  it('llama a PATCH /auth/perfil/telefono con contraseña y teléfono', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    (api.patch as jest.Mock).mockResolvedValueOnce({ id_cliente: 1, telefono: '+56912345678' });

    render(<UpdateTelefonoForm onUpdate={onUpdate} />);

    await user.type(screen.getByLabelText(/contraseña actual/i), 'TestPass1');
    await user.type(screen.getByLabelText(/nuevo teléfono/i), '+56912345678');
    await user.click(screen.getByRole('button', { name: /actualizar teléfono/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/auth/perfil/telefono', expect.any(Object));
      expect(onUpdate).toHaveBeenCalledWith('+56912345678');
    });
  });

  it.each(['9 1234 5678', '912345678', '56912345678', '+56 9 1234 5678'])(
    'un celular escrito como %s se guarda con el +56',
    async (escrito) => {
      const user = userEvent.setup();
      (api.patch as jest.Mock).mockResolvedValueOnce({ id_cliente: 1, telefono: '+56912345678' });
      render(<UpdateTelefonoForm />);
      await user.type(screen.getByLabelText(/contraseña actual/i), 'TestPass1');
      await user.type(screen.getByLabelText(/nuevo teléfono/i), escrito);
      await user.click(screen.getByRole('button', { name: /actualizar teléfono/i }));
      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith('/auth/perfil/telefono', {
          password_actual: 'TestPass1',
          telefono: '+56912345678',
        });
      });
    },
  );

  it('muestra error si la contraseña actual es incorrecta (CU-08 Excepción 2)', async () => {
    const user = userEvent.setup();
    (api.patch as jest.Mock).mockRejectedValueOnce({ message: 'La contraseña actual es incorrecta', status: 401 });

    render(<UpdateTelefonoForm />);

    await user.type(screen.getByLabelText(/contraseña actual/i), 'WrongPass');
    await user.type(screen.getByLabelText(/nuevo teléfono/i), '+56912345678');
    await user.click(screen.getByRole('button', { name: /actualizar teléfono/i }));

    await waitFor(() => {
      expect(screen.getByText(/contraseña actual es incorrecta/i)).toBeInTheDocument();
    });
  });
});
