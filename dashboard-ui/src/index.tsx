import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { HeaderProvider } from './contexts/HeaderContext';
import { KVStoreProvider } from './contexts/KVStoreContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { OverlayProvider } from './contexts/OverlayContext';
import { WorkflowProvider } from './contexts/WorkflowContext';
import { DashboardServerProvider } from './contexts/DashboardServerContext';
import { IntegrationsProvider } from './contexts/IntegrationsContext';
import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/auth/AuthGuard';
import Layout from './components/Layout';
import Canvas from './pages/Canvas';
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
      <NotificationProvider>
        <AuthProvider>
          <AuthGuard>
            <DashboardServerProvider>
                <OrganizationProvider>
                  <HeaderProvider>
                    <KVStoreProvider>
                      <SidebarProvider>
                        <OverlayProvider>
                          <IntegrationsProvider>
                            <WorkflowProvider>
                              <Router root={Layout}>
                                <Route path="/" component={Canvas} />
                                {/* Overlay routes that render Canvas but trigger overlays */}
                                <Route path="/workflows" component={Canvas} />
                                <Route path="/workflows/:id" component={Canvas} />
                                <Route path="/dashboard" component={Canvas} />
                                <Route path="/agents" component={Canvas} />
                                <Route path="/apps" component={Canvas} />
                                <Route path="/kv-store" component={Canvas} />
                                <Route path="/artifacts" component={Canvas} />
                                <Route path="/events" component={Canvas} />
                                <Route path="/settings" component={Canvas} />
                                <Route path="/chat" component={Canvas} />
                                <Route path="/node-designer" component={Canvas} />
                                {/* Catch-all route for any other paths */}
                                <Route path="*" component={Canvas} />
                              </Router>
                            </WorkflowProvider>
                          </IntegrationsProvider>
                        </OverlayProvider>
                      </SidebarProvider>
                    </KVStoreProvider>
                  </HeaderProvider>
                  </OrganizationProvider>
              </DashboardServerProvider>
          </AuthGuard>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  ),
  root!
);