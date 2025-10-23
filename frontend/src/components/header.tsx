"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import TotalEquityBadge from "@/components/total-equity-badge";

export function Header() {
  const pathname = usePathname();
  return (
    <header className="mb-4 border-b border-[var(--outline)] py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <Link href="/" className="pixel-heading text-lg font-bold leading-none">[SIGMA] Arena</Link>
      <nav className="pixel-label hidden md:flex items-center gap-2">
        <Link
          href="/"
          className={cn(
            "rounded-sm px-3 py-1 transition-colors",
            pathname === "/"
              ? "bg-foreground text-background font-bold hover:bg-foreground/90"
              : "text-foreground hover:bg-foreground/10"
          )}
          aria-current={pathname === "/" ? "page" : undefined}
        >
          Copytrading Agents
        </Link>
      </nav>
      <div className="flex items-center gap-2">
        <TotalEquityBadge />
        <div className="relative group">
          <Button asChild size="sm" className="rounded-none">
            <Link href="/">Launch Agent</Link>
          </Button>
          <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap border border-[var(--outline)] bg-background px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em] opacity-0 transition-opacity group-hover:opacity-100">
            Coming Soon
          </span>
        </div>
        {/* <Button
          variant="outline"
          size="icon"
          className="rounded-none"
          aria-label="Toggle theme"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button> */}
        <Button variant="outline" size="icon" className="md:hidden rounded-none" aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
