import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { AuthStateProvider } from '@/lib/auth-state';
import ParticipantPreview from '@/pages/assessments/participant';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Overview from '@/pages/overview';
import Home from '@/pages/home';
import WorkflowsList from '@/pages/workflows/list';
import WorkflowDetail from '@/pages/workflows/detail';
import World from '@/pages/world';
import Workspace from '@/pages/workspace';
import PopulationsList from '@/pages/populations/list';
import PopulationDetail from '@/pages/populations/detail';
import CharactersList from '@/pages/characters/list';
import CharacterDetail from '@/pages/characters/detail';
import AgentsList from '@/pages/agents/list';
import AgentDetail from '@/pages/agents/detail';
import SimulationsList from '@/pages/simulations/list';
import SimulationDetail from '@/pages/simulations/detail';
import EvaluationsList from '@/pages/evaluations/list';
import EvaluationDetail from '@/pages/evaluations/detail';
import AssessmentsList from '@/pages/assessments/list';
import AssessmentDetail from '@/pages/assessments/detail';
import ScenarioWizard from '@/pages/assessments/scenario-wizard';
import ScenarioStudio from '@/pages/scenario-studio';
import Explorer from '@/pages/explorer';
import Examples from '@/pages/examples';
import Benchmark from '@/pages/benchmark';
import Formats from '@/pages/formats/index';
import CommercialValidation from '@/pages/commercial-validation';
import {
  Route,
  Switch,
  Redirect,
  Router as WouterRouter,
  useLocation,
} from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      {/* Keep old bookmarks working without maintaining a second create screen. */}
      <Route path="/create" component={LegacyCreateRedirect} />
      <Route path="/workflows" component={WorkflowsList} />
      <Route path="/workflows/:id" component={WorkflowDetail} />
      <Route path="/examples" component={Examples} />
      
      <Route path="/overview" component={Overview} />
      <Route path="/world" component={World} />
      <Route path="/content/:id" component={Workspace} />
      
      <Route path="/populations" component={PopulationsList} />
      <Route path="/populations/:id" component={PopulationDetail} />
      
      <Route path="/characters" component={CharactersList} />
      <Route path="/characters/:id" component={CharacterDetail} />
      
      <Route path="/agents" component={AgentsList} />
      <Route path="/agents/:id" component={AgentDetail} />
      
      <Route path="/simulations" component={SimulationsList} />
      <Route path="/simulations/:id" component={SimulationDetail} />
      
      <Route path="/evaluations" component={EvaluationsList} />
      <Route path="/evaluations/:id" component={EvaluationDetail} />
      <Route path="/assessments" component={AssessmentsList} />
      <Route path="/assessments/new" component={ScenarioWizard} />
      <Route path="/scenario-studio" component={ScenarioStudio} />
      <Route path="/assessments/:id/participant" component={ParticipantPreview} />
      <Route path="/assessments/:id" component={AssessmentDetail} />
      <Route path="/assessments/:id/edit" component={AssessmentDetail} />
      
      <Route path="/explorer" component={Explorer} />
      <Route path="/benchmark" component={Benchmark} />
      <Route path="/formats" component={Formats} />
      <Route path="/commercial-validation" component={CommercialValidation} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function LegacyCreateRedirect() {
  return <Redirect to="/" />;
}

// REQUIRED — copy verbatim.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#EB2A14',
    colorForeground: '#171717',
    colorMutedForeground: '#5C5C5C',
    colorDanger: '#C42121',
    colorBackground: '#FFFFFF',
    colorInput: '#FCFCFC',
    colorInputForeground: '#171717',
    colorNeutral: '#171717',
    fontFamily: "'Inter', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#e3e3e3]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#171717] font-semibold',
    headerSubtitle: 'text-[#5C5C5C]',
    socialButtonsBlockButtonText: 'text-[#171717]',
    formFieldLabel: 'text-[#171717]',
    footerActionLink: 'text-[#EB2A14] font-medium',
    footerActionText: 'text-[#5C5C5C]',
    dividerText: 'text-[#5C5C5C]',
    identityPreviewEditButton: 'text-[#EB2A14]',
    formFieldSuccessText: 'text-[#171717]',
    alertText: 'text-[#171717]',
    logoBox: 'justify-center',
    logoImage: 'h-10 w-10',
    socialButtonsBlockButton: 'border border-[#e3e3e3] bg-white',
    formButtonPrimary: 'bg-[#EB2A14] text-white',
    formFieldInput: 'bg-[#FCFCFC] text-[#171717] border-[#e3e3e3]',
    footerAction: 'justify-center',
    dividerLine: 'bg-[#e3e3e3]',
    alert: 'border border-[#e3e3e3] bg-[#f2f2f2]',
    otpCodeFieldInput: 'border-[#e3e3e3] text-[#171717]',
    formFieldRow: 'gap-2',
    main: 'gap-4',
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        client.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);

  return null;
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  return (
    <AuthStateProvider value={{ isLoaded, isSignedIn: !!isSignedIn, signOut: () => void signOut({ redirectUrl: basePath || '/' }) }}>
      {children}
    </AuthStateProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'ContentX 로그인', subtitle: '진단 설계와 샘플은 로그인 후 사용할 수 있습니다' } },
        signUp: { start: { title: 'ContentX 계정 만들기', subtitle: '진단형 롤플레이 작성을 시작하세요' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <AuthBridge>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthBridge>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
