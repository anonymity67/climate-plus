import React from 'react';
import { CircleCheck } from 'lucide-react';

export function DoneNote({ did, means, next }) {
  return (
    <div className="guide-done" role="status">
      <CircleCheck size={20} aria-hidden="true" />
      <div>
        <p>
          <strong>You just </strong>
          {did}
        </p>
        {means && (
          <p>
            <strong>What it means: </strong>
            {means}
          </p>
        )}
        {next && (
          <p>
            <strong>Next: </strong>
            {next}
          </p>
        )}
      </div>
    </div>
  );
}
