// Line icons for the teacher's panel, drawn at 24px and sized by the caller.

type P = { size?: number };
const base = (size = 18) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const IconExams = ({ size }: P) => (
  <svg {...base(size)}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h4" /></svg>
);
export const IconPlus = ({ size }: P) => <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconClasses = ({ size }: P) => (
  <svg {...base(size)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.6c2.2.2 3.8 1.6 4.5 4.4" /></svg>
);
export const IconWallet = ({ size }: P) => (
  <svg {...base(size)}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><path d="M16 15h2" /></svg>
);
export const IconSettings = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const IconMenu = ({ size }: P) => <svg {...base(size)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IconClose = ({ size }: P) => <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconLogout = ({ size }: P) => (
  <svg {...base(size)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h11" /></svg>
);
export const IconDownload = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>
);
export const IconArrowLeft = ({ size }: P) => <svg {...base(size)}><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></svg>;
export const IconArrowRight = ({ size }: P) => <svg {...base(size)}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>;
export const IconSearch = ({ size }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;
export const IconCheck = ({ size }: P) => <svg {...base(size)}><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
export const IconAlert = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 3l9.5 17H2.5z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>
);
export const IconClock = ({ size }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconTrash = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l1 13h9l1-13" /></svg>
);
export const IconEdit = ({ size }: P) => <svg {...base(size)}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>;
