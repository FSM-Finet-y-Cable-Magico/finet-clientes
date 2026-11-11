"use client";

import { useAuth } from "../../../_lib/auth";
import PagaTuCuentaButton from "./PagaTuCuentaButton";
import PortalClienteButton from "./PortalClienteButton";
import UserMenu from "./UserMenu";

export default function NavbarAuthArea() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (isAuthenticated) return <UserMenu />;

  return (
    <>
      <PagaTuCuentaButton />
      <PortalClienteButton />
    </>
  );
}
