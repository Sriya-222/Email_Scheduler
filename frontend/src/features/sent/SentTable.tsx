import React from 'react';
import { Table, TableColumn } from '../../components/ui/Table';
import { Email } from '../../lib/types';
import { AlertCircle } from 'lucide-react';

interface SentTableProps {
  emails: Email[];
  loading: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  totalCount,
  limit,
  offset,
  onPageChange,
}) => {
  const columns: TableColumn<Email>[] = [
    {
      header: 'Recipient',
      render: (row) => <span style={{ fontWeight: 500 }}>{row.recipient}</span>,
    },
    {
      header: 'Subject',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--text-primary)' }}>{row.subject}</span>
          {row.status === 'failed' && row.error && (
            <span style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}>
              <AlertCircle size={12} />
              {row.error}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Sent At',
      render: (row) => <span>{row.sent_at ? new Date(row.sent_at).toLocaleString() : 'N/A'}</span>,
    },
    {
      header: 'Attempts',
      render: (row) => <span style={{ textAlign: 'center', display: 'block', width: '30px' }}>{row.attempts}</span>,
    },
    {
      header: 'Status',
      render: (row) => (
        <span className={`badge badge-${row.status}`}>
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={emails}
      loading={loading}
      emptyMessage="No sent/failed logs available."
      totalCount={totalCount}
      limit={limit}
      offset={offset}
      onPageChange={onPageChange}
    />
  );
};
