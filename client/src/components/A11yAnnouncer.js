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

  const srOnly = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  };

  return (
    <div ref={ref} aria-hidden="false">
      <div aria-live="polite" aria-atomic="true" style={srOnly}>{politeMsg}</div>
      <div aria-live="assertive" aria-atomic="true" style={srOnly}>{assertiveMsg}</div>
    </div>
  );
}
