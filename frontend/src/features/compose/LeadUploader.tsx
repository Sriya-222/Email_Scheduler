import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

interface LeadUploaderProps {
  onLeadsLoaded: (leads: string[]) => void;
  leadsCount: number;
}

export const LeadUploader: React.FC<LeadUploaderProps> = ({ onLeadsLoaded, leadsCount }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFile(files[0]);
  };

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      const result = await api.uploadLeads(file);
      onLeadsLoaded(result.emails);
      success(`Successfully parsed ${result.count} unique lead email addresses!`);
    } catch (err: any) {
      error(err.message || 'Failed to parse lead file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">Upload Leads (CSV or TXT)</label>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.txt"
        style={{ display: 'none' }}
      />
      
      <div 
        className="upload-area" 
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud size={32} />
        {loading ? (
          <p>Processing lead file...</p>
        ) : leadsCount > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--status-sent-text)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <CheckCircle2 size={16} />
              {leadsCount} Leads Loaded
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Click to replace file
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <span>Click to upload CSV / TXT list</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Must contain email addresses (comma separated or one per line)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
