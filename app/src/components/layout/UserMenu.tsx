"use client";

import Link from "next/link";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { logout } from "@/server/actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  name?: string | null;
  email?: string | null;
  /** el usuario es super admin (cambia "Mi perfil" → "Mi cuenta") */
  isAdmin?: boolean;
  /** sidebar colapsado en desktop: muestra solo el avatar */
  collapsed?: boolean;
}

export function UserMenu({ name, email, isAdmin, collapsed }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={collapsed ? (name ?? "Mi cuenta") : undefined}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-auto w-full justify-start gap-2 px-2 py-1.5",
          collapsed && "md:justify-center md:px-0",
        )}
      >
        <span className="bg-secondary text-secondary-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <UserIcon className="h-4 w-4" />
        </span>
        <span className={cn("truncate text-sm", collapsed && "md:hidden")}>
          {name ?? "Mi cuenta"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate font-normal">
            <div className="font-medium">{name}</div>
            <div className="text-muted-foreground text-xs">{email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/perfil" />}
          className="cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          {isAdmin ? "Mi cuenta" : "Mi perfil"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem
            render={<button type="submit" className="w-full" />}
            className="cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
