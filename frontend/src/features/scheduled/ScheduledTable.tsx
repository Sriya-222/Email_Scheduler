import React from 'react';
import { Table, TableColumn } from '../../components/ui/Table';
import { Email } from '../../lib/types';

interface ScheduledTableProps {
  emails: Email[];
  loading: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
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
      render: (row) => <span style={{ color: 'var(--text-primary)' }}>{row.subject}</span>,
    },
    {
      header: 'Scheduled Run Time',
      render: (row) => <span>{new Date(row.scheduled_at).toLocaleString()}</span>,
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
      emptyMessage="No scheduled emails yet. Click 'Schedule Campaign' to compose and launch one."
      totalCount={totalCount}
      limit={limit}
      offset={offset}
      onPageChange={onPageChange}
    />
  );
};
