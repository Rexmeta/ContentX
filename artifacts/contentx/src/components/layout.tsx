import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Terminal, Users, UserCircle, PlayCircle, BarChart, Network, 
  ChevronRight, Box, ListTodo, Settings2, Code, FlaskConical,
  ChevronDown, Lightbulb, PlusCircle, Library, Layers, Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface LayoutProps {
  children: ReactNode;
  breadcrumbs?: Breadcrumb[];
  title?: ReactNode;
  contextHeader?: ReactNode;
}

const primaryItems = [
  { href: "/", label: "만들기", icon: PlusCircle },
  { href: "/workflows", label: "내 작업", icon: ListTodo },
  { href: "/world", label: "라이브러리", icon: Library },
  { href: "/examples", label: "예시", icon: Lightbulb },
];

const advancedItems = [
  { href: "/benchmark", label: "벤치마크", icon: Layers },
  { href: "/commercial-validation", label: "상용 검증", icon: FlaskConical },
  { href: "/formats", label: "JSON 포맷", icon: Code },
  { href: "/populations", label: "가상 인구", icon: Users },
  { href: "/characters", label: "캐릭터", icon: UserCircle },
  { href: "/agents", label: "에이전트", icon: Terminal },
  { href: "/simulations", label: "시뮬레이션", icon: PlayCircle },
  { href: "/evaluations", label: "평가", icon: BarChart },
  { href: "/explorer", label: "그래프 탐색기", icon: Network },
  { href: "/overview", label: "대시보드", icon: Settings2 },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="h-14 border-b border-[hsl(var(--sidebar-border))] flex items-center px-5 shrink-0">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-[hsl(var(--sidebar-primary))]" />
          <span className="font-mono font-semibold text-sm tracking-[0.14em]">
            CONTENT<span className="text-[hsl(var(--sidebar-primary))]">X</span>
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4 px-3">
        <div className="space-y-1">
          {primaryItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-lg",
                  isActive
                    ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] font-semibold"
                    : "text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-foreground))]"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-[hsl(var(--sidebar-primary))]" : "")} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-8 mb-2 px-2 flex items-center justify-between">
          <span className="tech-label text-[hsl(var(--sidebar-foreground))]/45">
            고급 도구
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-[hsl(var(--sidebar-foreground))]/45 hover:text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", advancedOpen ? "rotate-180" : "")} />
          </Button>
        </div>

        {advancedOpen && (
          <div className="space-y-1 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {advancedItems.map((item) => {
              const isActive = location.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-lg border-l-2",
                    isActive
                      ? "border-[hsl(var(--sidebar-primary))] bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] font-semibold"
                      : "border-transparent text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-foreground))]"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-[hsl(var(--sidebar-primary))]" : "")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function Layout({ children, breadcrumbs = [], title, contextHeader }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground selection:bg-primary/20">

      {/* Desktop sidebar — dark contrast section */}
      <nav className="relative z-10 hidden md:flex w-64 shrink-0 flex-col border-r border-[hsl(var(--sidebar-border))]">
        <SidebarContent />
      </nav>

      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between gap-2 px-4 md:px-6">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile hamburger drawer */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-10 w-10 -ml-1 shrink-0"
                  aria-label="메뉴 열기"
                  data-testid="button-mobile-menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))]">
                <SheetTitle className="sr-only">내비게이션</SheetTitle>
                <SidebarContent onNavigate={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>

            {/* Breadcrumbs — collapse to last crumb on mobile */}
            <div className="flex items-center gap-2 text-sm min-w-0">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <div
                    key={idx}
                    className={cn("items-center gap-2 min-w-0", isLast ? "flex" : "hidden sm:flex")}
                  >
                    {idx > 0 && <ChevronRight className="hidden sm:block h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    {crumb.href ? (
                      <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground truncate">{crumb.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {title && (
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              {title}
            </div>
          )}
        </header>

        {contextHeader && (
          <div className="shrink-0 border-b border-border bg-muted/20 px-4 md:px-6 py-4">
            {contextHeader}
          </div>
        )}

        <main className="flex-1 overflow-auto custom-scrollbar relative">
          {children}
        </main>
      </div>
    </div>
  );
}
