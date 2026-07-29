import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../lib/api';
import { Sender } from '../../lib/types';
import { LeadUploader } from './LeadUploader';
import { useToast } from '../../components/ui/Toast';
import { X, RefreshCw } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: () => void;
}

function getDefaultStartTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  now.setSeconds(0, 0);
  const tzoffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzoffset).toISOString().slice(0, 16);
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onCampaignCreated }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [leads, setLeads] = useState<string[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [startTime, setStartTime] = useState(getDefaultStartTime);
  const [delayMs, setDelayMs] = useState(3000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const didFetch = useRef(false);

  const { success, error } = useToast();

  // Fetch senders whenever modal opens (reset on each open)
  useEffect(() => {
    if (!isOpen) {
      didFetch.current = false;
      return;
    }
    if (didFetch.current) return;
    didFetch.current = true;

    setLoadingSenders(true);
    setStartTime(getDefaultStartTime()); // Reset time to 5 min from now on every open
    api.getSenders()
      .then((data) => {
        setSenders(data);
        if (data.length > 0) {
          setSelectedSenderId(data[0].id);
        } else {
          setSelectedSenderId('');
        }
      })
      .catch((err: any) => {
        error(err.message || 'Failed to load SMTP sender accounts.');
      })
      .finally(() => setLoadingSenders(false));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (leads.length === 0) {
      error('Please upload at least one lead email address.');
      return;
    }
    if (!selectedSenderId) {
      error('Please select an SMTP sender account.');
      return;
    }
    const scheduledDate = new Date(startTime);
    if (isNaN(scheduledDate.getTime())) {
      error('Please enter a valid start time.');
      return;
    }
    if (scheduledDate <= new Date()) {
      error('Start time must be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.createCampaign({
        subject,
        body,
        leads,
        senderId: selectedSenderId,
        startTime: scheduledDate.toISOString(),
        delayMs,
        hourlyLimit,
      });

      success(`Campaign scheduled! ${result.scheduledCount} emails queued.`);
      onCampaignCreated();

      // Reset form state
      setSubject('');
      setBody('');
      setLeads([]);
      setStartTime(getDefaultStartTime());
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to schedule campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryLoadSenders = () => {
    didFetch.current = false;
    setLoadingSenders(true);
    api.getSenders()
      .then((data) => {
        setSenders(data);
        if (data.length > 0) setSelectedSenderId(data[0].id);
        else setSelectedSenderId('');
      })
      .catch((err: any) => error(err.message || 'Failed to load senders.'))
      .finally(() => setLoadingSenders(false));
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Schedule Campaign</h2>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.4rem', borderRadius: '50%' }} type="button" aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="campaign-subject">Subject Line</label>
            <input
              id="campaign-subject"
              type="text"
              className="form-control"
              placeholder="e.g. Quick question about your marketing stack"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="campaign-body">Email Body (HTML or plain text)</label>
            <textarea
              id="campaign-body"
              className="form-control"
              placeholder="<p>Hi there,</p><p>Check out our email scheduling tech...</p>"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="smtp-sender" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>SMTP Sender Account</span>
                <button
                  type="button"
                  onClick={handleRetryLoadSenders}
                  disabled={loadingSenders}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0 0.25rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  title="Refresh sender list"
                >
                  <RefreshCw size={11} className={loadingSenders ? 'spinner' : ''} />
                  {loadingSenders ? 'Loading...' : 'Refresh'}
                </button>
              </label>
              <select
                id="smtp-sender"
                className="form-control"
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                required
                disabled={loadingSenders || senders.length === 0}
                style={{ color: senders.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}
              >
                {loadingSenders ? (
                  <option value="">Loading senders...</option>
                ) : senders.length === 0 ? (
                  <option value="">No senders configured</option>
                ) : (
                  senders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.smtp_user})
                    </option>
                  ))
                )}
              </select>
              {!loadingSenders && senders.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--status-failed-text)' }}>
                  No SMTP senders found. The default test sender will be auto-created on the backend.
                  <button type="button" onClick={handleRetryLoadSenders} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem', padding: '0 0.25rem' }}>
                    Retry
                  </button>
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="start-time">Stagger Start Time</label>
              <input
                id="start-time"
                type="datetime-local"
                className="form-control"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="delay-ms">Delay Between Emails (ms)</label>
              <input
                id="delay-ms"
                type="number"
                className="form-control"
                min="0"
                step="500"
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="hourly-limit">Hourly Send Cap</label>
              <input
                id="hourly-limit"
                type="number"
                className="form-control"
                min="1"
                max="500"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <LeadUploader onLeadsLoaded={setLeads} leadsCount={leads.length} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || loadingSenders || senders.length === 0}
            >
              {submitting ? 'Scheduling...' : `Schedule ${leads.length > 0 ? leads.length + ' Emails' : 'Emails'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
