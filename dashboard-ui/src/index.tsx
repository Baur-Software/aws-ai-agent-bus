import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { MCPProvider } from './contexts/MCPContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { HeaderProvider } from './contexts/HeaderContext';
import { KVStoreProvider } from './contexts/KVStoreContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import KVStore from './pages/KVStore';
import Artifacts from './pages/Artifacts';
import Workflows from './pages/Workflows';
import Events from './pages/Events';
import Settings from './pages/Settings';
import AgentChat from './pages/AgentChat';
import IntegrationsSettings from './components/IntegrationsSettings';
import SidebarSettings from './components/SidebarSettings';
import './styles/tailwind.css';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?'
  );
}

render(
  () => (
    <ThemeProvider>
      <MCPProvider>
        <DashboardProvider>
          <OrganizationProvider>
            <NotificationProvider>
              <HeaderProvider>
                <KVStoreProvider>
                  <SidebarProvider>
                    <Router root={Layout}>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/kv-store" component={KVStore} />
              <Route path="/artifacts" component={Artifacts} />
              <Route path="/workflows" component={Workflows} />
              <Route path="/events" component={Events} />
              <Route path="/agent-chat" component={AgentChat} />
              <Route path="/settings" component={Settings} />
              <Route path="/settings/integrations" component={IntegrationsSettings} />
              <Route path="/settings/sidebar" component={SidebarSettings} />
                  </Router>
                  </SidebarProvider>
                </KVStoreProvider>
              </HeaderProvider>
            </NotificationProvider>
          </OrganizationProvider>
        </DashboardProvider>
      </MCPProvider>
    </ThemeProvider>
  ),
  root!
);