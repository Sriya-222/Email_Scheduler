import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { User, Email, DashboardStats } from '../lib/types';
import { UserMenu } from '../features/auth/UserMenu';
import { ScheduledTable } from '../features/scheduled/ScheduledTable';
import { SentTable } from '../features/sent/SentTable';
import { ComposeModal } from '../features/compose/ComposeModal';
import { useToast } from '../components/ui/Toast';
import { Send, RefreshCw, Layers, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    scheduled: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    rescheduled: 0,
    total: 0,
  });

  const [emails, setEmails] = useState<Email[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const limit = 20;

  const { error } = useToast();

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
    }
  }, []);

  const fetchEmails = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      // If we are on scheduled tab, fetch scheduled/processing/rescheduled
      // If we are on sent tab, fetch sent/failed
      const statusParam = activeTab === 'scheduled' 
        ? 'scheduled,processing,rescheduled' 
        : 'sent,failed';

      const data = await api.getEmails({
        status: statusParam,
        limit,
        offset,
      });

      setEmails(data.emails);
      setTotalCount(data.totalCount);
    } catch (err: any) {
      error(err.message || 'Failed to load email records.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeTab, offset, error]);

  // Combined fetch trigger
  const refreshData = useCallback(async (showLoading = false) => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchEmails(showLoading)]);
    setRefreshing(false);
  }, [fetchStats, fetchEmails]);

  // Initial load or tab/offset change
  useEffect(() => {
    refreshData(true);
  }, [activeTab, offset, refreshData]);

  // Auto-refresh poll every 5 seconds to animate queues live
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleCampaignCreated = () => {
    setOffset(0);
    refreshData(true);
  };

  return (
    <div className="dashboard-container">
      {/* Header bar */}
      <header className="navbar glass">
        <div className="logo">
          <Layers size={22} style={{ color: 'var(--primary)' }} />
          <span>ReachInbox</span>
        </div>
        <UserMenu user={user} onLogout={onLogout} />
      </header>

      {/* Stats Board */}
      <div className="stats-grid">
        <div className="stat-card glass">
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={14} style={{ color: 'var(--status-scheduled-text)' }} />
            Scheduled
          </span>
          <span className="value" style={{ color: 'var(--status-scheduled-text)' }}>
            {stats.scheduled}
          </span>
        </div>
        
        <div className="stat-card glass">
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={14} style={{ color: 'var(--status-processing-text)' }} className="spinner" />
            Processing
          </span>
          <span className="value" style={{ color: 'var(--status-processing-text)' }}>
            {stats.processing}
          </span>
        </div>

        <div className="stat-card glass">
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={14} style={{ color: 'var(--status-rescheduled-text)' }} />
            Rescheduled
          </span>
          <span className="value" style={{ color: 'var(--status-rescheduled-text)' }}>
            {stats.rescheduled}
          </span>
        </div>

        <div className="stat-card glass">
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={14} style={{ color: 'var(--status-sent-text)' }} />
            Sent
          </span>
          <span className="value" style={{ color: 'var(--status-sent-text)' }}>
            {stats.sent}
          </span>
        </div>

        <div className="stat-card glass">
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={14} style={{ color: 'var(--status-failed-text)' }} />
            Failed
          </span>
          <span className="value" style={{ color: 'var(--status-failed-text)' }}>
            {stats.failed}
          </span>
        </div>
      </div>

      {/* Main Content Card */}
      <main className="glass" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Tabs navigation */}
          <div className="tabs" style={{ margin: 0, borderBottom: 'none' }}>
            <button
              className={`tab ${activeTab === 'scheduled' ? 'active' : ''}`}
              onClick={() => { setActiveTab('scheduled'); setOffset(0); }}
            >
              Scheduled Queue ({stats.scheduled + stats.processing + stats.rescheduled})
            </button>
            <button
              className={`tab ${activeTab === 'sent' ? 'active' : ''}`}
              onClick={() => { setActiveTab('sent'); setOffset(0); }}
            >
              Processed Logs ({stats.sent + stats.failed})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => refreshData(false)}
              disabled={refreshing}
              title="Refresh lists"
              style={{ padding: '0.65rem' }}
            >
              <RefreshCw size={16} className={refreshing ? 'spinner' : ''} />
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setIsComposeOpen(true)}
            >
              <Send size={16} />
              Schedule Campaign
            </button>
          </div>
        </div>

        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={emails}
            loading={loading}
            totalCount={totalCount}
            limit={limit}
            offset={offset}
            onPageChange={setOffset}
          />
        ) : (
          <SentTable
            emails={emails}
            loading={loading}
            totalCount={totalCount}
            limit={limit}
            offset={offset}
            onPageChange={setOffset}
          />
        )}
      </main>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onCampaignCreated={handleCampaignCreated}
      />
    </div>
  );
};
export default Dashboard;
