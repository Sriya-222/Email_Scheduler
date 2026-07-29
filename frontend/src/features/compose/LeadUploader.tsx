import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, CheckCircle2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

interface LeadUploaderProps {
  onLeadsLoaded: (leads: string[]) => void;
  leadsCount: number;
}

export const LeadUploader: React.FC<LeadUploaderProps> = ({ onLeadsLoaded, leadsCount }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { success, error } = useToast();

  const processFile = useCallback(async (file: File) => {
    // Validate file type
    const allowedTypes = ['text/csv', 'text/plain', 'application/csv'];
    const allowedExtensions = ['.csv', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      error('Please upload a CSV or TXT file only.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      error('File too large. Maximum file size is 5MB.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.uploadLeads(file);
      if (result.count === 0) {
        error('No valid email addresses found in the uploaded file.');
        return;
      }
      onLeadsLoaded(result.emails);
      success(`Loaded ${result.count} unique email addresses.`);
    } catch (err: any) {
      error(err.message || 'Failed to parse lead file. Please check the file format.');
    } finally {
      setLoading(false);
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onLeadsLoaded, success, error]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFile(files[0]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLeadsLoaded([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="form-group">
      <label className="form-label">Upload Leads (CSV or TXT)</label>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.txt,text/csv,text/plain"
        style={{ display: 'none' }}
        id="lead-file-input"
        aria-label="Upload leads file"
      />

      <div
        className="upload-area"
        onClick={() => !loading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Click or drag to upload CSV or TXT file"
        style={{
          borderColor: dragOver ? 'var(--primary)' : leadsCount > 0 ? 'var(--status-sent-text)' : undefined,
          background: dragOver ? 'rgba(139, 92, 246, 0.06)' : undefined,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <>
            <div className="spinner" style={{ width: '28px', height: '28px', borderTopColor: 'var(--primary)' }} />
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Parsing file...</p>
          </>
        ) : leadsCount > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={28} style={{ color: 'var(--status-sent-text)' }} />
            <span style={{ color: 'var(--status-sent-text)', fontWeight: 600 }}>
              {leadsCount} Leads Loaded
            </span>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
              >
                Replace file
              </button>
              <button
                type="button"
                onClick={handleClear}
                style={{ background: 'none', border: 'none', color: 'var(--status-failed-text)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <X size={12} /> Clear
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
            <UploadCloud size={28} style={{ color: dragOver ? 'var(--primary)' : undefined }} />
            <span style={{ fontWeight: 500 }}>
              {dragOver ? 'Drop file here' : 'Click or drag & drop to upload'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              CSV or TXT — one email per line, or comma-separated
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
