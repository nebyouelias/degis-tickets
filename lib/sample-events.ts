/**
 * Placeholder catalog. Replaced by the Postgres-backed catalog in Phase 1 —
 * keep the shape of this type: it becomes the Prisma model.
 */
export type EventTier = "GA" | "VIP" | "VVIP";

export type DegisEvent = {
  id: string;
  slug: string;
  title: string;
  titleAm?: string; // Amharic title
  category: "Concert" | "Football" | "Festival" | "Nightlife" | "Comedy" | "Conference";
  venue: string;
  city: string;
  date: string; // ISO
  priceFromEtb: number;
  vip: boolean;
  soldOut?: boolean;
  image: string;
};

export const sampleEvents: DegisEvent[] = [
  {
    id: "1",
    slug: "meskel-square-concert",
    title: "New Year Concert at Meskel Square",
    titleAm: "የአዲስ ዓመት ኮንሰርት",
    category: "Concert",
    venue: "Meskel Square",
    city: "Addis Ababa",
    date: "2026-09-11T18:00:00+03:00",
    priceFromEtb: 800,
    vip: true,
    image:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=70",
  },
  {
    id: "2",
    slug: "sheger-comedy-night",
    title: "Sheger Comedy Night",
    titleAm: "የሸገር ኮሜዲ ምሽት",
    category: "Comedy",
    venue: "Hyatt Regency",
    city: "Addis Ababa",
    date: "2026-08-14T20:00:00+03:00",
    priceFromEtb: 500,
    vip: true,
    image:
      "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=1200&q=70",
  },
  {
    id: "3",
    slug: "addis-derby",
    title: "Addis Derby — St. George vs Ethiopia Bunna",
    titleAm: "የአዲስ ደርቢ",
    category: "Football",
    venue: "Addis Ababa Stadium",
    city: "Addis Ababa",
    date: "2026-08-22T15:00:00+03:00",
    priceFromEtb: 150,
    vip: false,
    image:
      "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1200&q=70",
  },
  {
    id: "4",
    slug: "rooftop-sessions",
    title: "Rooftop Sessions — Bole",
    category: "Nightlife",
    venue: "Sky Lounge, Bole",
    city: "Addis Ababa",
    date: "2026-08-08T21:00:00+03:00",
    priceFromEtb: 600,
    vip: true,
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=70",
  },
  {
    id: "5",
    slug: "irreecha-festival",
    title: "Irreecha Festival Gathering",
    category: "Festival",
    venue: "Hora Finfinne",
    city: "Addis Ababa",
    date: "2026-10-03T08:00:00+03:00",
    priceFromEtb: 200,
    vip: false,
    image:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=70",
  },
  {
    id: "6",
    slug: "tech-summit-addis",
    title: "Addis Tech Summit 2026",
    category: "Conference",
    venue: "Millennium Hall",
    city: "Addis Ababa",
    date: "2026-11-05T09:00:00+03:00",
    priceFromEtb: 1200,
    vip: true,
    image:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=70",
  },
];

export function formatEtb(amount: number) {
  return new Intl.NumberFormat("en-ET", { maximumFractionDigits: 0 }).format(amount);
}

export function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Addis_Ababa",
  });
}
