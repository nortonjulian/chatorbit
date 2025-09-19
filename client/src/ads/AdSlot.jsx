import { useEffect, useRef, useState } from 'react';
import { useAds } from './AdProvider';

/**
 * Usage (AdSense today):
 *   <AdSlot placement="chat-list-top" adsenseSlot={import.meta.env.VITE_ADSENSE_SLOT_CHAT_TOP} />
 *
 * Usage (Prebid+GAM later):
 *   <AdSlot placement="chat-list-top" sizes={[[300,250],[320,50]]} />
 *
 * Optional house fallback:
 *   <AdSlot ... fallback={<UpgradeCard />} />
 */
export default function AdSlot({
  placement,
  className,
  // AdSense:
  adsenseSlot,
  // Prebid:
  sizes = [[300, 250], [320, 50]],
  // Common:
  style,
  fallback = null,
}) {
  // ☂️ Tests often run without a provider; don't destructure a null context.
  const ctx = typeof useAds === 'function' ? useAds() : null;
  const adapter = ctx?.adapter;
  const isPremium = ctx?.isPremium;
  const ready = ctx?.ready;
  const adsense = ctx?.adsense;
  const prebid = ctx?.prebid;
  const ensurePrebid = ctx?.ensurePrebid;

  const [shown, setShown] = useState(false);
  const containerRef = useRef(null);
  const renderedRef = useRef(false);
  const viewedRef = useRef(false);

  // If no ads context/adapter (or user is premium), render fallback or nothing.
  if (!ctx || !adapter || isPremium) {
    return fallback ? (
      <div className={className} aria-label={`ad-${placement}`}>{fallback}</div>
    ) : null;
  }

  // Lazy render (first viewport entry)
  useEffect(() => {
    if (!containerRef.current || viewedRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          viewedRef.current = true;
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px 200px 0px', threshold: 0.01 }
    );
    io.observe(containerRef.current);
    return () => io.disconnect();
  }, []);

  // AdSense flow
  useEffect(() => {
    if (!shown || !ready || renderedRef.current) return;
    if (adapter !== 'adsense') return;
    if (!adsense?.client || !adsenseSlot) return;

    try {
      let ins = containerRef.current?.querySelector('ins.adsbygoogle');
      if (!ins && containerRef.current) {
        ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.setAttribute('data-ad-client', adsense.client);
        ins.setAttribute('data-ad-slot', adsenseSlot);
        ins.setAttribute('data-ad-format', 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');
        containerRef.current.appendChild(ins);
      }
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      renderedRef.current = true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ads] AdSense render failed', e);
    }
  }, [shown, ready, adapter, adsense?.client, adsenseSlot]);

  // Prebid + GPT flow
  useEffect(() => {
    if (!shown || !ready || renderedRef.current) return;
    if (adapter !== 'prebid') return;

    const { googletag, pbjs } = window;
    if (!googletag || !pbjs) return;

    // 1) Ensure adUnit + GPT slot are defined for this placement
    ensurePrebid?.(placement, sizes);

    // 2) Ensure the GPT container div exists
    const slotId = `gpt-${placement}`;
    let el = document.getElementById(slotId);
    if (!el && containerRef.current) {
      el = document.createElement('div');
      el.id = slotId;
      el.style.minHeight = '50px';
      containerRef.current.appendChild(el);
    }
    if (!el) return;

    // 3) Request bids, then display/refresh GPT
    pbjs.que.push(() => {
      pbjs.requestBids({
        adUnitCodes: [placement],
        timeout: prebid?.timeoutMs || 1000,
        bidsBackHandler: () => {
          pbjs.setTargetingForGPTAsync([placement]);
          googletag.cmd.push(() => {
            googletag.display(slotId);
            googletag.pubads().refresh();
          });
          renderedRef.current = true;
        },
      });
    });
  }, [shown, ready, adapter, placement, sizes, prebid, ensurePrebid]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        minHeight: 64,
        display: 'block',
        width: '100%',
        ...(style || {}),
      }}
      aria-label={`ad-${placement}`}
    >
      {!shown && fallback ? fallback : null}
    </div>
  );
}
