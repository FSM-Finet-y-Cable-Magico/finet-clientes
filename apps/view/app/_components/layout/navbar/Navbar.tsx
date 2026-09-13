import NavLogo from "./NavLogo";
import NavbarAuthArea from "./NavbarAuthArea";
import ThemeToggle from "./ThemeToggle";
import MobileMenu from "./MobileMenu";
import DesktopNavItem from "./DesktopNavItem";
import AudienceSwitch from "./AudienceSwitch";
import { navItems, audienceSwitch } from "./nav.config";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-7xl">
        {/* Top strip: audience switch + theme toggle */}
        <div className="flex items-center justify-between border-b border-border px-4 py-1.5 text-xs">
          <AudienceSwitch items={audienceSwitch} />
          <ThemeToggle />
        </div>

        {/* Main bar: logo + nav + search + portal button */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <NavLogo />
            <nav aria-label="Navegacion principal" className="hidden md:block">
              <ul className="flex items-center gap-5">
                {navItems.map((item) => (
                  <DesktopNavItem key={item.href} item={item} />
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <NavbarAuthArea />
            <MobileMenu items={navItems} />
          </div>
        </div>
      </div>
    </header>
  );
}
