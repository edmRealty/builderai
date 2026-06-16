export const ACTIVE_PROJECT_STATUSES = [
  {
    value: "LOT_ACQUIRED",
    label: "Lot acquired",
    dotClass: "bg-sky-500",
    prompt: null
  },
  {
    value: "PLANNING",
    label: "Planning",
    dotClass: "bg-indigo-500",
    prompt: null
  },
  {
    value: "UNDER_CONSTRUCTION",
    label: "Under Construction",
    dotClass: "bg-amber-500",
    prompt: null
  },
  {
    value: "COMPLETED_FOR_SALE",
    label: "Completed For Sale",
    dotClass: "bg-emerald-600",
    prompt: {
      title: "Would you like to post to Zillow / Costar?",
      primary: "Post to Zillow",
      secondary: "Post to Costar"
    }
  },
  {
    value: "COMPLETED_FOR_RENT",
    label: "Completed For Rent",
    dotClass: "bg-violet-600",
    prompt: {
      title: "Would you like to export to Buildium?",
      primary: "Export to Buildium"
    }
  }
] as const;

export type ActiveProjectStatus = (typeof ACTIVE_PROJECT_STATUSES)[number]["value"];

const legacyStatusMap: Record<string, ActiveProjectStatus> = {
  COMPLETED: "COMPLETED_FOR_SALE",
  FOR_SALE: "COMPLETED_FOR_SALE",
  RENTAL_READY: "COMPLETED_FOR_RENT"
};

export const ACTIVE_PROJECT_STATUS_VALUES = ACTIVE_PROJECT_STATUSES.map((status) => status.value) as [ActiveProjectStatus, ...ActiveProjectStatus[]];

export function normalizeProjectStatus(status: string): ActiveProjectStatus {
  if (legacyStatusMap[status]) return legacyStatusMap[status];
  if (ACTIVE_PROJECT_STATUS_VALUES.includes(status as ActiveProjectStatus)) return status as ActiveProjectStatus;
  return "PLANNING";
}

export function projectStatusMeta(status: string) {
  const normalized = normalizeProjectStatus(status);
  return ACTIVE_PROJECT_STATUSES.find((item) => item.value === normalized) ?? ACTIVE_PROJECT_STATUSES[1];
}

export function projectStatusFilterValues(status: string) {
  const normalized = normalizeProjectStatus(status);
  if (normalized === "COMPLETED_FOR_SALE") return ["COMPLETED_FOR_SALE", "COMPLETED", "FOR_SALE"];
  if (normalized === "COMPLETED_FOR_RENT") return ["COMPLETED_FOR_RENT", "RENTAL_READY"];
  return [status];
}
