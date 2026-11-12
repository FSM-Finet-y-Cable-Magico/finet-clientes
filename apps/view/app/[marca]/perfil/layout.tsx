import PortalShell from "../../_components/portal/PortalShell";

export default function PerfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
