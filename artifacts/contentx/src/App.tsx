import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import Explorer from '@/pages/explorer';
import Examples from '@/pages/examples';
import Benchmark from '@/pages/benchmark';
import Formats from '@/pages/formats/index';
import {
  Route,
  Switch,
  Redirect,
  Router as WouterRouter,
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
      
      <Route path="/explorer" component={Explorer} />
      <Route path="/benchmark" component={Benchmark} />
      <Route path="/formats" component={Formats} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function LegacyCreateRedirect() {
  return <Redirect to="/" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
