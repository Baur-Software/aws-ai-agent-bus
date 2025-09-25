import { createSignal, Show } from 'solid-js';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { usePageHeader } from '../contexts/HeaderContext';

function Analytics() {
  const [loading, setLoading] = createSignal(false);
  const { analytics } = useDashboardServer();
  
  // Set page-specific header
  usePageHeader('Analytics', 'Google Analytics insights and reports');

  return (
    <div class="analytics-page">
      <div class="page-header">
        <div class="page-title">
          <h1>Analytics</h1>
          <p>Google Analytics insights and reports</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary">
            <i class="fas fa-sync-alt" />
            Refresh Data
          </button>
        </div>
      </div>

      <div class="analytics-content">
        <div class="coming-soon">
          <i class="fas fa-chart-line" />
          <h2>Analytics Dashboard</h2>
          <p>Interactive analytics dashboard coming soon!</p>
          <p>This will include charts, metrics, and real-time data visualization.</p>
        </div>
      </div>
    </div>
  );
}

export default Analytics;