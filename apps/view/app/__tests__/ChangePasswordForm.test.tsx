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

import ChangePasswordForm from '@/app/components/ChangePasswordForm';
import { api } from '@/app/utils/api';

describe('ChangePasswordForm (CU-10/CU-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza formulario con 3 campos de contraseña', () => {
    render(<ChangePasswordForm />);
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar contraseña/i })).toBeInTheDocument();
  });

  it('llama a PATCH /auth/perfil/password (CU-10)', async () => {
    const user = userEvent.setup();
    (api.patch as jest.Mock).mockResolvedValueOnce({ mensaje: 'Contrasena actualizada correctamente' });

    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText('Contraseña actual'), 'OldPass1');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'NewPass1!');
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'NewPass1!');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/auth/perfil/password', expect.any(Object));
      expect(screen.getByText(/contraseña actualizada correctamente/i)).toBeInTheDocument();
    });
  });

  it('valida complejidad — rechaza sin mayúscula (CU-11)', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText('Contraseña actual'), 'OldPass1');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'sinmayuscula1!');
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'sinmayuscula1!');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText("Al menos 1 mayúscula y 1 número")).toBeInTheDocument();
    });
  });

  it('valida que las contraseñas nuevas coincidan', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText('Contraseña actual'), 'OldPass1');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'NewPass1!');
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Different1!');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
    });
  });
});
