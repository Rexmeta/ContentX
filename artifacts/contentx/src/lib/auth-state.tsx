import { createContext, useContext, type ReactNode } from "react";
import { Link } from "wouter";
import { LockKeyhole } from "lucide-react";

export type AuthState = { isLoaded: boolean; isSignedIn: boolean; signOut?: () => void };

/** Defaults to signed-out so any tree without Clerk (tests, public pages) stays safe. */
const AuthStateContext = createContext<AuthState>({ isLoaded: true, isSignedIn: false });

export const AuthStateProvider = AuthStateContext.Provider;
export const useAuthState = () => useContext(AuthStateContext);

export function SignedInGate({ children, reason }: { children: ReactNode; reason: string }) {
  const { isLoaded, isSignedIn } = useAuthState();
  if (!isLoaded) return <div data-testid="status-auth-loading" className="h-24 rounded-xl border bg-muted/40 animate-pulse" />;
  if (isSignedIn) return <>{children}</>;
  return (
    <div data-testid="status-auth-required" className="rounded-xl border border-dashed p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="flex gap-3">
        <LockKeyhole className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">로그인이 필요합니다</p>
          <p className="text-xs text-muted-foreground mt-0.5">{reason}</p>
        </div>
      </div>
      <Link href="/sign-in" data-testid="link-sign-in" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">로그인</Link>
    </div>
  );
}
