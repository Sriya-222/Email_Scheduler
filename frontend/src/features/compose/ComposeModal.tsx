import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Sender } from '../../lib/types';
import { LeadUploader } from './LeadUploader';
import { useToast } from '../../components/ui/Toast';
import { X } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onCampaignCreated }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [leads, setLeads] = useState<string[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    now.setSeconds(0, 0);
    // Format to localized YYYY-MM-DDTHH:mm for browser datetime picker
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localTime = new Date(now.getTime() - tzoffset).toISOString().slice(0, 16);
    return localTime;
  });
  const [delayMs, setDelayMs] = useState(3000); // default 3s staggering
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    if (isOpen) {
      api.getSenders()
        .then((data) => {
          setSenders(data);
          if (data.length > 0) {
            setSelectedSenderId(data[0].id);
          }
        })
        .catch(() => {
          error('Failed to load SMTP sender list.');
        });
    }
  }, [isOpen, error]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (leads.length === 0) {
      error('Please upload at least one email address lead.');
      return;
    }
    if (!selectedSenderId) {
      error('Please select an active SMTP sender.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.createCampaign({
        subject,
        body,
        leads,
        senderId: selectedSenderId,
        startTime: new Date(startTime).toISOString(),
        delayMs,
        hourlyLimit,
      });

      success(`Campaign scheduled! Queued ${result.scheduledCount} stagger emails.`);
      onCampaignCreated();
      
      // Reset form
      setSubject('');
      setBody('');
      setLeads([]);
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to schedule campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Schedule Campaign</h2>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.4rem', borderRadius: '50%' }} type="button">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div className="form-group">
            <label className="form-label">Subject Line</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Quick question about your marketing stack"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">HTML Content / Body</label>
            <textarea
              className="form-control"
              placeholder="<p>Hi there,</p><p>Check out our email queueing tech...</p>"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">SMTP Sender account</label>
              <select
                className="form-control"
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                required
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.smtp_user})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Stagger Start Time</label>
              <input
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
              <label className="form-label">Delay Staggering (ms)</label>
              <input
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
              <label className="form-label">Hourly Sender Cap</label>
              <input
                type="number"
                className="form-control"
                min="1"
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
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Scheduling...' : 'Schedule Emails'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
