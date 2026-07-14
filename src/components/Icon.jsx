export function Icon({ name, size = 20 }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
        <path d="M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M3 21h18" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    chart: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
    tags: (
      <>
        <path d="m3 12 9 9 9-9-9-9H3v9Z" />
        <circle cx="8" cy="8" r="1.5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    arrowLeft: <path d="m15 18-6-6 6-6" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6zM14 2v5h5" />
        <path d="M9 13h6M9 17h5" />
      </>
    ),
    reset: (
      <>
        <path d="M4 4v6h6M20 20v-6h-6" />
        <path d="M5.5 15a8 8 0 0 0 13-6M18.5 9a8 8 0 0 0-13 6" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h14V10M9 21v-6h6v6" />
      </>
    ),
    wallet: (
      <>
        <path d="M3 6h16a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6Z" />
        <path d="M3 6V5a2 2 0 0 1 2-2h12v3M16 12h5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    minus: <path d="M5 12h14" />,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
