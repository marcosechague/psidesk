"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  NotebookPen,
  BarChart3,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";

const COLLAPSE_KEY = "sidebar-collapsed";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  match?: string[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/sesiones", label: "Sesiones", icon: NotebookPen },
  { href: "/agenda", label: "Calendario", icon: Calendar },
  { href: "/tests", label: "Tests", icon: ClipboardList },
  { href: "/tratamientos", label: "Tratamientos", icon: Stethoscope },
  {
    href: "/plantillas",
    label: "Plantillas y estilo",
    icon: FileText,
    match: ["/plantillas"],
  },
  { href: "/panel", label: "Panel", icon: BarChart3 },
];

// Menú del super admin: distinto al del psicólogo (no es un tenant, no tiene
// pacientes/sesiones propias). Mientras impersona ve el menú de psicólogo.
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Plataforma", icon: ShieldCheck, exact: true },
  {
    href: "/admin/psicologos",
    label: "Psicólogos",
    icon: Users,
    match: ["/admin/psicologos"],
  },
  { href: "/admin/funciones", label: "Funciones", icon: SlidersHorizontal },
  { href: "/admin/ia", label: "IA", icon: Sparkles },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: UserRole };
  /** el admin está viendo la app como un psicólogo (impersonación) */
  impersonating?: boolean;
}

export function Sidebar({ user, impersonating }: SidebarProps) {
  const pathname = usePathname();
  const nav =
    user.role === "SUPER_ADMIN" && !impersonating ? ADMIN_NAV : NAV;

  // El colapso solo aplica en desktop (md+); en mobile el menú es una barra
  // horizontal. Persistimos la preferencia para que sobreviva a recargas.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border flex flex-col gap-1 border-b p-3 md:sticky md:top-0 md:h-screen md:border-r md:border-b-0 md:transition-[width] md:duration-200",
        collapsed ? "md:w-16" : "md:w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-3",
          collapsed && "md:justify-center md:px-0",
        )}
      >
        <span className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-serif text-lg">
          P
        </span>
        <span className={cn("font-serif text-xl", collapsed && "md:hidden")}>
          Psidesk
        </span>
      </div>

      <nav className="flex gap-1 overflow-x-auto md:flex-1 md:flex-col md:overflow-visible">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : (item.match ?? [item.href]).some((h) => pathname.startsWith(h));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                collapsed && "md:justify-center md:px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="md:mt-auto md:space-y-1">
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className={cn(
            "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:flex",
            collapsed && "md:justify-center md:px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          <span className={cn(collapsed && "md:hidden")}>Colapsar</span>
        </button>
        <UserMenu
          name={user.name}
          email={user.email}
          isAdmin={user.role === "SUPER_ADMIN" && !impersonating}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}
