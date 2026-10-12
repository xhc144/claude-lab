import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildEmailDoc, type EmailDocOptions } from '../lib/sanitize';

/** Renders sanitised e-mail HTML in a sandboxed iframe that grows to fit its content. */
export function EmailFrame(props: EmailDocOptions & { onRemoteCount?: (n: number) => void; onLinkHover?: (url: string | null) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const { doc, remoteCount, themed } = React.useMemo(() => buildEmailDoc(props), [props.html, props.text, props.allowRemote, props.dark, props.darkMode, props.messageId, props.collapseQuotes, props.attachmentToken]);

  useEffect(() => { props.onRemoteCount?.(remoteCount); }, [remoteCount]);

  useLayoutEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    const fit = () => {
      const d = iframe.contentDocument;
      if (!d || !d.body) return;
      const body = d.body;
      body.style.zoom = '';
      const avail = iframe.clientWidth;
      const wide = Math.max(body.scrollWidth, d.documentElement.scrollWidth);
      // Fit fixed-width newsletters into narrow reading panes instead of scrolling sideways.
      if (wide > avail + 4 && avail > 200) body.style.zoom = String(Math.max(0.55, avail / wide));
      const h = Math.ceil(d.documentElement.getBoundingClientRect().height);
      setHeight(Math.max(40, h + 2));
    };
    const onLoad = () => {
      const d = iframe.contentDocument;
      if (!d) return;
      fit();
      ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); });
      ro.observe(d.documentElement);
      ro.observe(iframe);
      d.addEventListener('toggle', () => requestAnimationFrame(fit), true);
      d.addEventListener('mouseover', (e) => {
        const a = (e.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null;
        props.onLinkHover?.(a ? a.href : null);
      });
      d.addEventListener('mouseout', () => props.onLinkHover?.(null));
      // Images load late and change the height.
      d.querySelectorAll('img').forEach((img) => img.addEventListener('load', () => requestAnimationFrame(fit)));
    };
    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [doc]);

  return (
    <iframe
      ref={ref}
      className={themed ? 'email-frame is-themed' : 'email-frame'}
      title="邮件正文"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      style={{ height }}
    />
  );
}
