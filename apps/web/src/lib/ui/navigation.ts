export type NavigationTarget =
  | "commandCenter"
  | "onboarding"
  | "dashboard"
  | "setup"
  | "readiness"
  | "brief"
  | "dataOnboarding"
  | "scanner"
  | "equityResearch"
  | "tradeAgent"
  | "triage"
  | "quality"
  | "notifications"
  | "journal"
  | "review"
  | "account"
  | "preferences";

export type NavigationItem = {
  key: NavigationTarget;
  href: string;
  label: string;
  section: string;
  shortLabel?: string;
  description: string;
};

export const navigationItems: NavigationItem[] = [
  { key: "commandCenter", href: "/command-center", label: "Overview", section: "Workspace", description: "Your next setups and daily review" },
  { key: "onboarding", href: "/onboarding", label: "Onboarding", section: "Command Center", description: "First-run setup and readiness gate" },
  { key: "dashboard", href: "/dashboard", label: "Markets", section: "Workspace", description: "Follow your symbols and watchlists" },
  { key: "brief", href: "/brief", label: "Brief", section: "Brief", description: "Workspace daily brief and review focus" },
  { key: "dataOnboarding", href: "/data/onboarding", label: "Market data", section: "Data", description: "Manage sources and candle freshness" },
  { key: "scanner", href: "/scanner", label: "Scanner", section: "Scanner", description: "Watchlists and deterministic scan configs" },
  { key: "equityResearch", href: "/equity-research", label: "Equity Research", shortLabel: "Equities", section: "Scanner", description: "Stock universes and swing setup candidate review" },
  { key: "tradeAgent", href: "/trade-agent", label: "Paper plans", section: "Research", description: "Review your saved paper plans" },
  { key: "triage", href: "/triage", label: "Setups", section: "Workspace", description: "Find a setup, open its chart, and review the evidence" },
  { key: "quality", href: "/quality", label: "Data quality", section: "Quality", description: "Review reliability and observed behavior" },
  { key: "notifications", href: "/notifications", label: "Notifications", shortLabel: "Inbox", section: "Notifications", description: "In-app intelligence event review" },
  { key: "journal", href: "/journal", label: "Journal", section: "Journal", description: "Observation notes and outcome reflection" },
  { key: "review", href: "/review/outcomes", label: "Review Outcomes", shortLabel: "Outcomes", section: "Journal", description: "Observed outcome review queue" },
  { key: "setup", href: "/setup", label: "Setup", section: "Preferences", description: "Workspace setup wizard" },
  { key: "readiness", href: "/readiness", label: "Workspace health", section: "Preferences", description: "Check workspace and data readiness" },
  { key: "account", href: "/account", label: "Account", section: "Preferences", description: "Identity and session management" },
  { key: "preferences", href: "/preferences/strategy", label: "Preferences", section: "Preferences", description: "Review filter profiles" },
];

export const primaryNavigationTargets: NavigationTarget[] = [
  "commandCenter",
  "dashboard",
  "triage",
  "scanner",
  "journal",
];

export const secondaryNavigationTargets: NavigationTarget[] = [
  "brief", "tradeAgent", "review", "equityResearch", "notifications", "dataOnboarding",
  "quality", "onboarding", "setup", "readiness", "preferences", "account",
];

export const navigationSections = Array.from(new Set(navigationItems.map((item) => item.section)));

export function navigationHref(target: NavigationTarget, workspaceId?: string | null): string {
  const item = navigationItems.find((candidate) => candidate.key === target);
  const href = item?.href || "/command-center";
  if (!workspaceId) {
    return href;
  }
  return `${href}?workspaceId=${workspaceId}`;
}

export function isActiveNavigationPath(pathname: string, href: string): boolean {
  if (href === "/triage" && pathname.startsWith("/signals/")) {
    return true;
  }
  if (href === "/dashboard" && pathname.startsWith("/symbols/")) {
    return true;
  }
  if (href === "/command-center") {
    return pathname === "/" || pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
