import React from 'react';

export default function SkipToContent({ targetId = 'main-content' }) {
  return (
    <a className="skip-to-content" href={`#${targetId}`}>
      Skip to main content
    </a>
  );
}
