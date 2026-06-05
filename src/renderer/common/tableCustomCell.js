import React from 'react';
import { Tooltip } from '@fluentui/react-components';

export default function TableCustomCell({ children }) {
  return (
    <Tooltip content={children}>
      <td>{children || '--'}</td>
    </Tooltip>
  );
}
