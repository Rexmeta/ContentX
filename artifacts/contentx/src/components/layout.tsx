import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Terminal, Globe, Users, UserCircle, PlayCircle, BarChart, Network, 
  ChevronRight, Box
} from "lucide-react";

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

const navItems = [
  { href: "/", label: "Overview", icon: Terminal },
  { href: "/world", label: "World", icon: Globe },
  { href: "/populations", label: "Population", icon: Users },
  { href: "/characters", label: "Characters", icon: UserCircle },
  { href: "/agents", label: "Agents", icon: Terminal },
  { href: "/simulations", label: "Simulation", icon: PlayCircle },
  { href: "/evaluations", label: "Evaluation", icon: BarChart },
  { href: "/explorer", label: "Graph Explorer", icon: Network },
];

export function Layout({ children, breadcrumbs = [], title, contextHeader }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground selection:bg-primary/20">
      {/* Background Noise */}
      <div className="fixed inset-0 bg-noise z-0 pointer-events-none"></div>

      {/* Main Sidebar Navigation */}
      <nav className="relative z-10 w-64 border-r border-border bg-card/80 backdrop-blur-sm flex flex-col shadow-sm">
        <div className="h-14 border-b border-border flex items-center px-4 shrink-0 bg-muted/30">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm tracking-wide">
              CONTENT<span className="text-muted-foreground">X</span>
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">
            Lifecycle
          </div>
          {navItems.map((item) => {
            const isActive = location === item.href || 
                             (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors border-l-2 ${
                  isActive 
                    ? "border-primary bg-primary/5 text-foreground font-semibold" 
                    : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Top Header / Breadcrumbs */}
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

        {/* Context Header (if provided) */}
        {contextHeader && (
          <div className="shrink-0 border-b border-border bg-muted/20 px-6 py-4">
            {contextHeader}
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto custom-scrollbar relative">
          {children}
        </main>
      </div>
    </div>
  );
}
