import { Input } from '@fluentui/react-components';
import { evaluate } from 'mathjs';
import React, { useState } from 'react';

export default function Calculator({ top, left, setIsComponentVisible }) {
  const [expression, setExpression] = useState('');

  const handleEnter = (e) => {
    console.log(e);
    if (e.key === 'Enter') {
      try {
        setExpression(evaluate(expression));
      } catch (er) {
        console.log(er);
      }
    }
    if (e.key === 'Escape') {
      setIsComponentVisible(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
      }}
    >
      <Input
        onKeyDown={handleEnter}
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        autoFocus
        placeholder="Calculate"
      />
    </div>
  );
}
