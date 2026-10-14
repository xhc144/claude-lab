// Stroke icons (24×24 grid).
import type { SVGProps } from 'react';

const S = (d: string | string[], fill = false) =>
  function Icon(p: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
        {(Array.isArray(d) ? d : [d]).map((x, i) => <path key={i} d={x} />)}
      </svg>
    );
  };

export const IconMic = S(['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M19 11a7 7 0 0 1-14 0', 'M12 18v3']);
export const IconHistory = S(['M3 12a9 9 0 1 0 3-6.7', 'M3 4v4h4', 'M12 7v5l3 2']);
export const IconTarget = S(['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 12h.01']);
export const IconBook = S(['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z', 'M4 19a2 2 0 0 1 2-2h13']);
export const IconSettings = S(['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z']);
export const IconPlay = S('M7 4.5v15l12.5-7.5z', true);
export const IconPause = S(['M7 4h3.5v16H7z', 'M13.5 4H17v16h-3.5z'], true);
export const IconStop = S('M6 6h12v12H6z', true);
export const IconVolume = S(['M11 5 6 9H3v6h3l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13']);
export const IconLoop = S(['M17 2l3 3-3 3', 'M3 11V9a4 4 0 0 1 4-4h13', 'M7 22l-3-3 3-3', 'M21 13v2a4 4 0 0 1-4 4H4']);
export const IconRefresh = S(['M21 12a9 9 0 1 1-2.6-6.4', 'M21 3v6h-6']);
export const IconDownload = S(['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16']);
export const IconSparkle = S(['M12 3l1.8 4.9L19 9.5l-5.2 1.7L12 16l-1.8-4.8L5 9.5l5.2-1.6z', 'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z']);
export const IconChevronL = S('M15 18l-6-6 6-6');
export const IconChevronR = S('M9 18l6-6-6-6');
export const IconClose = S(['M18 6 6 18', 'M6 6l12 12']);
export const IconTrash = S(['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6']);
export const IconStar = S('M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z');
export const IconSearch = S(['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3']);
export const IconPlus = S(['M12 5v14', 'M5 12h14']);
export const IconUpload = S(['M12 21V9', 'M7 14l5-5 5 5', 'M4 3h16']);
export const IconEdit = S(['M4 20h4L19 9l-4-4L4 16v4z', 'M14 6l4 4']);
export const IconFolder = S('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z');
export const IconCopy = S(['M9 9h11v11H9z', 'M5 15H4V4h11v1']);
export const IconCheck = S('M5 12l5 5L20 7');
export const IconWave = S(['M3 12h2', 'M7 8v8', 'M11 5v14', 'M15 9v6', 'M19 11v2']);
export const IconCompare = S(['M8 3v18', 'M16 3v18', 'M3 8h5', 'M16 16h5']);
export const IconInfo = S(['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v6', 'M12 7h.01']);
export const IconSlow = S(['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l-3 2']);
