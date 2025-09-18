import { useEffect } from 'react';

export default function usePageTitle(title, { announce = true } = {}) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = String(title);
    if (announce && window.__announce) window.__announce(title);
    return () => { document.title = prev; };
  }, [title, announce]);
}
