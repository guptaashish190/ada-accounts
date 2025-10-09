import React from 'react';

const ModernTable = ({ 
  columns = [], 
  data = [], 
  className = '',
  headerClassName = '',
  rowClassName = '',
  cellClassName = '',
  onRowClick = null,
  loading = false,
  emptyMessage = 'No data available',
  showAlternatingRows = true
}) => {
  if (loading) {
    return (
      <div style={{
        background: '#f8fafc',
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{
        background: '#f8fafc',
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#f8fafc',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #e2e8f0',
      ...className
    }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
        background: '#f1f5f9',
        padding: '12px 16px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#475569',
        borderBottom: '1px solid #e2e8f0',
        ...headerClassName
      }}>
        {columns.map((column, index) => (
          <div 
            key={index}
            style={{
              textAlign: column.align || 'left',
              ...column.headerStyle
            }}
          >
            {column.title}
          </div>
        ))}
      </div>

      {/* Rows */}
      {data.map((row, rowIndex) => (
        <div 
          key={rowIndex}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
            padding: '12px 16px',
            fontSize: '13px',
            borderBottom: rowIndex < data.length - 1 ? '1px solid #e2e8f0' : 'none',
            backgroundColor: showAlternatingRows && rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
            cursor: onRowClick ? 'pointer' : 'default',
            transition: 'background-color 0.2s ease',
            ...rowClassName
          }}
          onClick={() => onRowClick && onRowClick(row, rowIndex)}
          onMouseEnter={(e) => {
            if (onRowClick) {
              e.target.style.backgroundColor = '#f1f5f9';
            }
          }}
          onMouseLeave={(e) => {
            if (onRowClick) {
              e.target.style.backgroundColor = showAlternatingRows && rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
            }
          }}
        >
          {columns.map((column, colIndex) => (
            <div 
              key={colIndex}
              style={{
                textAlign: column.align || 'left',
                color: column.color || '#1f2937',
                fontWeight: column.fontWeight || 'normal',
                ...column.cellStyle,
                ...cellClassName
              }}
            >
              {column.render ? column.render(row[column.key], row, rowIndex) : row[column.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ModernTable;
