/**
 * Icons transcribed verbatim from the approved design so the stroke geometry
 * matches. Lucide is available for anything new, but where the design already
 * drew a path, that path is the contract.
 */
type IconProps = { size?: number; className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const DashboardIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const CondoIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M9 7h2M9 11h2M9 15h2M15 11h4v10" />
  </svg>
);

export const BookingIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M4 2h16v20l-3-2-3 2-3-2-3 2z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

export const CalendarIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M8 2v4M16 2v4M3 10h18" />
  </svg>
);

export const IncomeIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M22 7l-8.5 8.5-5-5L2 17" />
    <path d="M16 7h6v6" />
  </svg>
);

export const ExpenseIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M20 7H4a1 1 0 0 1 0-2h13a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" />
    <circle cx="17" cy="13" r="1.3" />
  </svg>
);

export const PlusIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SearchIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const BellIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

export const RefreshIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

export const MenuIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

export const CloseIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

/** Sidebar rail toggle: a panel with the edge the click will move. */
export const PanelCollapseIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M10 4v16M16.5 9.5L14 12l2.5 2.5" />
  </svg>
);

export const PanelExpandIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M10 4v16M14 9.5l2.5 2.5L14 14.5" />
  </svg>
);

export const EditIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

export const TrashIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </svg>
);

export const CheckIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className} strokeWidth={2.5}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/** Held capital — a vault, deliberately unlike the ExpenseIcon wallet. */
export const DepositIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 6.5v2.3M12 15.2v2.3M15.5 12h2M6.5 12h2" />
  </svg>
);

export const MoreIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className} strokeWidth={2.5}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </svg>
);

/** FAB glyph: a calendar with a plus, matching "add a booking on a date". */
export const CalendarPlusIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
    <path d="M8 2v4M16 2v4M3 10h18M18 16v6M15 19h6" />
  </svg>
);

export const ChevronRightIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const WalletIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M20 7H4a1 1 0 0 1 0-2h13a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" />
    <circle cx="17" cy="13" r="1.3" />
  </svg>
);

export const ChartIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M6 20V10M12 20V4M18 20v-6" />
  </svg>
);

export const UsersIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const LogoutIcon = ({ size, className }: IconProps) => (
  <svg {...base} width={size} height={size} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);
