export type NavItem = { label: string; href: string; children?: NavItem[] };

export const navItems: NavItem[] = [
  {
    label: "Inicio",
    href: "/",
  },
  { label: "Planes", href: "/planes" },
  // Rama ppt: TV, Canales y Parrilla no se enlazan (no hay contenido de TV).
  { label: "Cobertura", href: "/cobertura" },
  // Junto a Cobertura porque son las dos herramientas del sitio: una para ver
  // si llega la red y otra para medirla (CU-34/35).
  { label: "Test de velocidad", href: "/velocidad" },
  { label: "Ayuda", href: "/ayuda" },
];

export const audienceSwitch = [
  { label: "Personas", href: "/" },
  { label: "Empresas", href: "/empresas" },
];
