import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Terminal, Globe, Users, UserCircle, PlayCircle, BarChart, Network, 
  ChevronRight, Box, LayoutGrid, PlusSquare, ListTodo, Settings2,
  ChevronDown, Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  { href: "/", label: "홈", icon: LayoutGrid },
  { href: "/create", label: "만들기", icon: PlusSquare },
  { href: "/workflows", label: "내 작업", icon: ListTodo },
  { href: "/examples", label: "예시", icon: Lightbulb },
];

const advancedItems = [
  { href: "/world", label: "이야기 세계", icon: Globe },
  { href: "/populations", label: "가상 인구", icon: Users },
  { href: "/characters", label: "캐릭터", icon: UserCircle },
  { href: "/agents", label: "에이전트", icon: Terminal },
  { href: "/simulations", label: "시뮬레이션", icon: PlayCircle },
  { href: "/evaluations", label: "평가", icon: BarChart },
  { href: "/explorer", label: "그래프 탐색기", icon: Network },
  { href: "/overview", label: "대시보드", icon: Settings2 },
];

export function Layout({ children, breadcrumbs = [], title, contextHeader }: LayoutProps) {
  const [location] = useLocation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground selection:bg-primary/20">
      <div className="fixed inset-0 bg-noise z-0 pointer-events-none"></div>

      <nav className="relative z-10 w-64 border-r border-border bg-card/80 backdrop-blur-sm flex flex-col shadow-sm">
        <div className="h-14 border-b border-border flex items-center px-4 shrink-0 bg-muted/30">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm tracking-wide">
              CONTENT<span className="text-muted-foreground">X</span>
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
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-sm",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "")} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-8 mb-2 px-2 flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
              고급 도구
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
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
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-sm border-l-2",
                      isActive
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{crumb.label}</span>
                )}
              </div>
            ))}
          </div>
          {title && (
            <div className="flex items-center gap-4">
              {title}
            </div>
          )}
        </header>

        {contextHeader && (
          <div className="shrink-0 border-b border-border bg-muted/20 px-6 py-4">
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
