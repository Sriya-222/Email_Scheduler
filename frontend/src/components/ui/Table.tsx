import React from 'react';
import { Spinner } from './Spinner';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export interface TableColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading: boolean;
  emptyMessage?: string;
  totalCount?: number;
  limit?: number;
  offset?: number;
  onPageChange?: (newOffset: number) => void;
}

export function Table<T>({
  columns,
  data,
  loading,
  emptyMessage = 'No data found.',
  totalCount = 0,
  limit = 20,
  offset = 0,
  onPageChange,
}: TableProps<T>) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);

  const handlePrev = () => {
    if (onPageChange && offset - limit >= 0) {
      onPageChange(offset - limit);
    }
  };

  const handleNext = () => {
    if (onPageChange && offset + limit < totalCount) {
      onPageChange(offset + limit);
    }
  };

  return (
    <div className="glass" style={{ padding: '1rem', width: '100%' }}>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '4rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <Spinner />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Fetching records...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                  <div className="empty-state">
                    <Inbox size={44} />
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx}>{col.render(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && totalCount > limit && onPageChange && (
        <div className="pagination">
          <div>
            Showing <b>{offset + 1}</b> to <b>{Math.min(offset + limit, totalCount)}</b> of <b>{totalCount}</b> records
          </div>
          <div className="pagination-buttons">
            <button
              className="btn btn-secondary"
              onClick={handlePrev}
              disabled={currentPage === 1}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              type="button"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-secondary"
              onClick={handleNext}
              disabled={currentPage === totalPages}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              type="button"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
