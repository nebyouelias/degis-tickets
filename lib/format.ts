export function formatEtb(amount: number) {
  return new Intl.NumberFormat("en-ET", { maximumFractionDigits: 0 }).format(amount);
}

export function formatEventDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Addis_Ababa",
  });
}

export function formatEventDateTime(date: Date) {
  return date.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Addis_Ababa",
  });
}

export const categoryLabels: Record<string, string> = {
  CONCERT: "Concert",
  FOOTBALL: "Football",
  FESTIVAL: "Festival",
  NIGHTLIFE: "Nightlife",
  COMEDY: "Comedy",
  CONFERENCE: "Conference",
  CULTURAL: "Cultural",
  CHURCH: "Church",
  OTHER: "Event",
};
