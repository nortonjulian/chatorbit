import { useEffect, useRef, useState } from 'react';

/**
 * Global screen-reader announcer. Mount once near the root.
 * Call anywhere: window.__announce?.('Message', { assertive: false })
 */
export default function A11yAnnouncer() {
  const ref = useRef(null);
  const [politeMsg, setPolite] = useState('');
  const [assertiveMsg, setAssertive] = useState('');

  useEffect(() => {
    window.__announce = (msg, opts = {}) => {
      const { assertive = false } = opts;
      const text = String(msg || '');
      if (assertive) {
        setAssertive('');
        setTimeout(() => setAssertive(text), 10);
      } else {
        setPolite('');
        setTimeout(() => setPolite(text), 10);
      }
    };
    return () => { delete window.__announce; };
  }, []);

  return (
    <div ref={ref} aria-hidden="false">
      <div
        id="a11y-announcer-polite"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {politeMsg}
      </div>
      <div
        id="a11y-announcer-assertive"
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
      >
        {assertiveMsg}
      </div>
    </div>
  );
}
