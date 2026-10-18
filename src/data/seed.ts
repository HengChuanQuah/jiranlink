import type {
  AppState, AvailabilityTemplate, Booking, Config, LatLng, Message, PaymentOptions, Promotion, Provider, RequestPost, Review, Service, User,
} from "./types";
import { addDays, addMinutes, atTime, now, startOfDay } from "../lib/time";
import { zoneById } from "./geo";

// All people, businesses, reviews and promotions below are SAMPLE DATA for the demo.

export const DEFAULT_CONFIG: Config = {
  qualityFloor: 3.5,
  floorExemptReviews: 3,
  newMaxReviews: 10,
  newMaxDays: 90,
  priorMean: 4.0,
  priorWeight: 3,
  pastWeight: 0.5,
  pastMax: 5,
  targetResults: 5,
  ringsKm: [2, 5, 10],
  exceptionStarGap: 0.5,
  exceptionMinReviews: 10,
  holdHours: 24,
  aiConfident: 0.7,
  aiLead: 0.2,
  aiLost: 0.4,
  aiProvider: (import.meta.env?.VITE_AI_PROVIDER as Config["aiProvider"]) || (import.meta.env?.VITE_AI_PROXY_URL ? "proxy" : "none"),
  aiProxyUrl: (import.meta.env?.VITE_AI_PROXY_URL as string) || "",
  aiModel: (import.meta.env?.VITE_AI_MODEL as string) || "",
  aiKey: (import.meta.env?.VITE_AI_KEY as string) || "",
  mapsKey: (import.meta.env?.VITE_GOOGLE_MAPS_KEY as string) || "",
  mapId: (import.meta.env?.VITE_GOOGLE_MAP_ID as string) || "",
};

// Small deterministic random generator so the seed is identical on every reset.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function offset(p: LatLng, northM: number, eastM: number): LatLng {
  return [p[0] + northM / 111_320, p[1] + eastM / (111_320 * Math.cos((p[0] * Math.PI) / 180))];
}

const ZONE_POINTS: Record<string, LatLng> = {
  "elmina-green": [3.2045, 101.4925],
  "elmina-valley": [3.1948, 101.4952],
  ilham: [3.1925, 101.5078],
  "elmina-cc": [3.2012, 101.5052],
  "melawati-north": [3.2165, 101.7495],
  "melawati-south": [3.2075, 101.7505],
  east57: [3.2102, 101.7298],
  "kleast-central": [3.205, 101.7345],
  quarza: [3.2051, 101.7342],
  // online providers live outside the pilot townships
  "outside-sj": [3.0733, 101.5185],
  "outside-cheras": [3.0865, 101.7445],
};

const ZONE_LABEL: Record<string, string> = {
  "elmina-green": "Elmina Green", "elmina-valley": "Elmina Valley", ilham: "Ilham Residence", "elmina-cc": "Elmina City Centre",
  "melawati-north": "Taman Melawati", "melawati-south": "Taman Melawati", east57: "East 57, KL East", "kleast-central": "KL East",
  quarza: "Quarza Residence", "outside-sj": "Subang Jaya", "outside-cheras": "Cheras",
};

const weekdaysMorningAfternoon: AvailabilityTemplate = {
  days: [1, 2, 3, 4, 5, 6], blocks: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
  slotMins: 90, bufferMins: 30, capacity: 1, minNoticeHrs: 12, horizonDays: 14, daysOff: [],
};
const eveningsWeekends: AvailabilityTemplate = {
  days: [0, 2, 4, 6], blocks: [{ start: "10:00", end: "13:00" }, { start: "18:00", end: "21:00" }],
  slotMins: 60, bufferMins: 0, capacity: 1, minNoticeHrs: 6, horizonDays: 14, daysOff: [],
};
const tuitionTemplate: AvailabilityTemplate = {
  days: [1, 3, 5, 6], blocks: [{ start: "15:00", end: "21:00" }],
  slotMins: 60, bufferMins: 0, capacity: 3, minNoticeHrs: 12, horizonDays: 21, daysOff: [],
};
const pickupTemplate: AvailabilityTemplate = {
  days: [0, 1, 2, 3, 4, 5, 6], blocks: [{ start: "10:00", end: "12:00" }, { start: "16:00", end: "19:00" }],
  slotMins: 60, bufferMins: 0, capacity: 4, minNoticeHrs: 24, horizonDays: 14, daysOff: [],
};
const halfDayTemplate: AvailabilityTemplate = {
  days: [1, 2, 3, 4, 5, 6], blocks: [{ start: "08:30", end: "12:30" }, { start: "13:30", end: "17:30" }],
  slotMins: 240, bufferMins: 0, capacity: 1, minNoticeHrs: 24, horizonDays: 14, daysOff: [],
};

type SvcDef = [categoryId: string, title: string, description: string, min: number, max: number, unit: string, online?: boolean];

interface ProvDef {
  id: string;
  name: string;
  zone: string;
  at: [number, number]; // offset in metres from the zone point (north, east)
  homeBased: boolean;
  radiusKm: number;
  bio: string;
  services: SvcDef[];
  reviews: number; // number of booked-via-app reviews
  avg: number;
  past?: number; // past-customer reviews
  joinedDaysAgo: number;
  avail: AvailabilityTemplate;
  pay?: Partial<PaymentOptions>;
  social?: Provider["social"];
  socialVerified?: boolean;
  intro?: string;
  responseMins: number;
  hue: number;
}

const PROVIDERS: ProvDef[] = [
  // ---------------- City of Elmina ----------------
  { id: "p-ani", name: "Kak Ani's Kitchen", zone: "elmina-green", at: [60, -40], homeBased: true, radiusKm: 6, hue: 12,
    bio: "Home baker in Elmina Green since 2019. Birthday cakes, brownies and kuih for open houses. Pick-up from my house or delivery within Elmina.",
    services: [["cakes", "Birthday cakes (1 kg to 3 kg)", "Chocolate moist, pandan gula melaka, red velvet. Custom toppers on request.", 85, 220, "per cake"],
      ["kuih", "Kuih platters for events", "Seri muka, onde-onde, karipap. Minimum 50 pieces.", 45, 120, "per platter"]],
    reviews: 32, avg: 4.8, past: 3, joinedDaysAgo: 400, avail: pickupTemplate, pay: { before: true, after: false, depositPct: 50 },
    social: { instagram: "kakani.kitchen" }, socialVerified: true, responseMins: 35 },
  { id: "p-meiling", name: "Mei Ling Bakes", zone: "elmina-green", at: [-120, 90], homeBased: true, radiusKm: 5, hue: 330,
    bio: "Weekend baker, Japanese-style cotton cheesecake and chiffon. Just started taking orders from neighbours.",
    services: [["cakes", "Cotton cheesecake & chiffon", "6-inch and 8-inch. Less sweet, made fresh on the day.", 55, 110, "per cake"]],
    reviews: 1, avg: 5, past: 2, joinedDaysAgo: 21, avail: { ...pickupTemplate, days: [5, 6, 0] }, pay: { before: true, after: true, depositPct: 0 },
    social: { instagram: "meiling.bakes.my" }, socialVerified: true, intro: "RM10 off your first order", responseMins: 50 },
  { id: "p-rosnah", name: "Puan Rosnah Bakeri", zone: "elmina-valley", at: [40, 30], homeBased: true, radiusKm: 8, hue: 28,
    bio: "Kek lapis Sarawak and butter cakes. Orders open all year, busiest before Raya.",
    services: [["cakes", "Kek lapis & butter cake", "Kek lapis Sarawak, butter cake, marble cake.", 60, 180, "per cake"],
      ["kuih", "Biskut raya (seasonal)", "Tart nenas, almond london, makmur.", 35, 45, "per tub"]],
    reviews: 15, avg: 4.6, joinedDaysAgo: 300, avail: pickupTemplate, pay: { before: true, after: true, depositPct: 30 }, responseMins: 90 },
  { id: "p-hafiz", name: "Hafiz Cool Aircond", zone: "elmina-valley", at: [-80, -60], homeBased: true, radiusKm: 10, hue: 200,
    bio: "Aircond servicing and gas top-up for Elmina homes. 9 years experience, own van and equipment.",
    services: [["aircond", "Aircond general service", "Wall-mounted 1.0 to 2.5 hp. Clean filter, coil, drain pipe.", 70, 90, "per unit"],
      ["aircond", "Chemical wash & leak fix", "For units dripping water or not cold.", 150, 220, "per unit"]],
    reviews: 41, avg: 4.5, joinedDaysAgo: 520, avail: weekdaysMorningAfternoon, pay: { before: false, after: true, depositPct: 0 },
    social: { facebook: "hafizcoolaircond" }, socialVerified: true, responseMins: 25 },
  { id: "p-kumar", name: "Kumar Home Services", zone: "elmina-cc", at: [30, 40], homeBased: false, radiusKm: 12, hue: 160,
    bio: "Small shop-lot team: aircond, plumbing and handyman jobs across Elmina and Bukit Subang.",
    services: [["aircond", "Aircond service", "Including drainage check.", 80, 100, "per unit"],
      ["plumbing", "Plumbing repairs", "Leaking pipes, clogged sinks, toilet flush, water heater install.", 60, 250, "per job"],
      ["handyman", "Handyman visit", "Curtain rails, shelves, door hinges, furniture assembly.", 60, 150, "per visit"]],
    reviews: 27, avg: 4.3, joinedDaysAgo: 610, avail: halfDayTemplate, pay: { before: true, after: true, depositPct: 0 }, responseMins: 40 },
  { id: "p-siti", name: "Siti Kemas Rumah", zone: "elmina-valley", at: [100, 120], homeBased: true, radiusKm: 7, hue: 280,
    bio: "Part-time home cleaning with my sister. We bring our own supplies.",
    services: [["cleaning", "Home cleaning (4 hours)", "Mopping, bathrooms, kitchen, windows. Two cleaners.", 120, 160, "per visit"]],
    reviews: 19, avg: 4.7, joinedDaysAgo: 250, avail: halfDayTemplate, pay: { before: true, after: true, depositPct: 0 }, responseMins: 60 },
  { id: "p-sparkle", name: "QuickSparkle Cleaning", zone: "elmina-cc", at: [-60, -50], homeBased: false, radiusKm: 12, hue: 50,
    bio: "Cleaning team serving Elmina.",
    services: [["cleaning", "Standard home cleaning", "3-hour clean.", 90, 130, "per visit"]],
    reviews: 8, avg: 2.9, joinedDaysAgo: 120, avail: halfDayTemplate, pay: { before: true, after: false, depositPct: 0 }, responseMins: 240 },
  { id: "p-ahmad-garden", name: "Pak Ahmad Landskap", zone: "ilham", at: [20, -30], homeBased: true, radiusKm: 6, hue: 110,
    bio: "Retired estate supervisor. Grass cutting, pruning and small landscaping jobs.",
    services: [["gardening", "Grass cutting & pruning", "Front and back garden, includes clearing cuttings.", 50, 120, "per visit"]],
    reviews: 22, avg: 4.9, joinedDaysAgo: 700, avail: { ...weekdaysMorningAfternoon, blocks: [{ start: "08:00", end: "11:00" }], slotMins: 180, bufferMins: 0 },
    pay: { before: false, after: true, depositPct: 0 }, responseMins: 120 },
  { id: "p-farah-tutor", name: "Cikgu Farah Tuisyen", zone: "elmina-green", at: [-30, 150], homeBased: true, radiusKm: 4, hue: 240,
    bio: "Former secondary school teacher. Maths and Add Maths for Form 1 to Form 5, small groups at my home.",
    services: [["tuition", "Maths & Add Maths (Form 1 to 5)", "Groups of up to 3 students. SPM past-year practice.", 50, 70, "per hour"]],
    reviews: 14, avg: 4.9, joinedDaysAgo: 365, avail: tuitionTemplate, pay: { before: true, after: true, depositPct: 0 }, responseMins: 45 },
  { id: "p-irfan-pet", name: "Irfan Pet Sitting", zone: "ilham", at: [-70, 60], homeBased: true, radiusKm: 4, hue: 90,
    bio: "Cat and dog sitting while you travel. Daily visits with photo updates.",
    services: [["petcare", "Pet sitting visits", "30-minute visit: feeding, litter, playtime.", 25, 35, "per visit"]],
    reviews: 4, avg: 4.5, joinedDaysAgo: 60, avail: { ...eveningsWeekends, days: [0, 1, 2, 3, 4, 5, 6], capacity: 2 }, pay: { before: true, after: true, depositPct: 0 },
    intro: "First visit free for neighbours", responseMins: 20 },
  { id: "p-nadia-mua", name: "Nadia MUA", zone: "elmina-cc", at: [80, -20], homeBased: true, radiusKm: 15, hue: 350,
    bio: "Makeup for weddings, engagements and photoshoots. I come to you.",
    services: [["beauty", "Event & bridal makeup", "Includes hijab styling or hair do.", 150, 450, "per session"]],
    reviews: 23, avg: 4.8, joinedDaysAgo: 480, avail: { ...eveningsWeekends, days: [5, 6, 0], blocks: [{ start: "07:00", end: "15:00" }], slotMins: 120 }, pay: { before: false, after: false, depositPct: 50 },
    social: { instagram: "nadia.mua.elmina", tiktok: "nadiamua" }, socialVerified: true, responseMins: 30 },
  { id: "p-zul-errand", name: "Zul Runner", zone: "elmina-valley", at: [-150, -20], homeBased: true, radiusKm: 8, hue: 20,
    bio: "Groceries, parcel pick-ups and bill payments for busy families and older residents.",
    services: [["errands", "Errands & grocery runs", "Up to 2 hours, you pay for items plus the fee.", 20, 40, "per run"]],
    reviews: 2, avg: 4, joinedDaysAgo: 30, avail: { ...weekdaysMorningAfternoon, slotMins: 60, bufferMins: 0 }, pay: { before: false, after: true, depositPct: 0 }, responseMins: 15 },

  // ---------------- Taman Melawati ----------------
  { id: "p-faizal", name: "Faizal Aircond Melawati", zone: "melawati-north", at: [40, -60], homeBased: true, radiusKm: 8, hue: 205,
    bio: "Aircond servicing for Taman Melawati and Ulu Klang. Weekday and Saturday slots.",
    services: [["aircond", "Aircond service & chemical wash", "General service or chemical wash for dripping or weak cooling units.", 70, 200, "per unit"]],
    reviews: 24, avg: 4.7, joinedDaysAgo: 450, avail: weekdaysMorningAfternoon, pay: { before: false, after: true, depositPct: 0 },
    social: { facebook: "faizal.aircond.melawati" }, socialVerified: true, responseMins: 20 },
  { id: "p-lim-aircond", name: "Lim Brothers Aircond", zone: "melawati-south", at: [-30, 50], homeBased: false, radiusKm: 10, hue: 190,
    bio: "Family business since 1998. Aircond installation, servicing and repair.",
    services: [["aircond", "Aircond repair & install", "Gas top-up, PCB repair, new installation.", 80, 400, "per job"]],
    reviews: 58, avg: 4.4, joinedDaysAgo: 900, avail: halfDayTemplate, pay: { before: true, after: true, depositPct: 0 }, responseMins: 60 },
  { id: "p-ravi-plumb", name: "Ravi Plumbing", zone: "melawati-south", at: [60, -80], homeBased: true, radiusKm: 8, hue: 215,
    bio: "Plumber living in Taman Melawati. Leaks, clogs and water heaters.",
    services: [["plumbing", "Plumbing repairs", "Pipe leaks, clogged sinks, toilet cistern, water heater.", 60, 300, "per job"]],
    reviews: 31, avg: 4.6, joinedDaysAgo: 700, avail: weekdaysMorningAfternoon, pay: { before: false, after: true, depositPct: 0 }, responseMins: 30 },
  { id: "p-auntie-wong", name: "Auntie Wong Nyonya Kuih", zone: "melawati-north", at: [-90, 30], homeBased: true, radiusKm: 6, hue: 340,
    bio: "Nyonya kuih made the old way. Order by 8pm for next-day pick-up.",
    services: [["kuih", "Nyonya kuih", "Kuih lapis, ang ku, seri muka, pulut tai tai.", 30, 90, "per box"],
      ["cakes", "Pandan chiffon", "Classic pandan chiffon cake.", 35, 45, "per cake"]],
    reviews: 47, avg: 4.9, joinedDaysAgo: 800, avail: pickupTemplate, pay: { before: true, after: true, depositPct: 0 }, responseMins: 45 },
  { id: "p-clean1", name: "Mira Home Cleaning", zone: "melawati-north", at: [120, 100], homeBased: true, radiusKm: 6, hue: 290,
    bio: "Home cleaning for landed houses.", services: [["cleaning", "Home cleaning (4 hours)", "Full house clean.", 110, 150, "per visit"]],
    reviews: 17, avg: 4.3, joinedDaysAgo: 420, avail: halfDayTemplate, responseMins: 90 },
  { id: "p-clean2", name: "Kak Long Cleaning", zone: "melawati-south", at: [-110, 20], homeBased: true, radiusKm: 6, hue: 300,
    bio: "Weekly or one-off cleaning.", services: [["cleaning", "Weekly home cleaning", "3 to 4 hours.", 100, 140, "per visit"]],
    reviews: 12, avg: 4.1, joinedDaysAgo: 380, avail: halfDayTemplate, responseMins: 120 },
  { id: "p-clean3", name: "Melawati Maid Helpers", zone: "melawati-south", at: [20, 160], homeBased: false, radiusKm: 8, hue: 310,
    bio: "Part-time cleaners, 2 per team.", services: [["cleaning", "Part-time cleaners", "2 cleaners, 3 hours.", 120, 150, "per visit"]],
    reviews: 26, avg: 4.0, joinedDaysAgo: 650, avail: halfDayTemplate, responseMins: 60 },
  { id: "p-clean4", name: "Rina Kemas", zone: "melawati-north", at: [-40, -150], homeBased: true, radiusKm: 5, hue: 270,
    bio: "Cleaning and ironing.", services: [["cleaning", "Cleaning + ironing", "4 hours, includes ironing one basket.", 120, 160, "per visit"],
      ["laundry", "Ironing only", "One basket.", 30, 40, "per basket"]],
    reviews: 9, avg: 4.2, joinedDaysAgo: 200, avail: halfDayTemplate, responseMins: 75 },
  { id: "p-clean5", name: "Hana Bersih", zone: "melawati-south", at: [140, -140], homeBased: true, radiusKm: 6, hue: 260,
    bio: "Move-in and deep cleaning.", services: [["cleaning", "Deep cleaning", "Move-in or post-renovation.", 250, 450, "per job"]],
    reviews: 11, avg: 3.9, joinedDaysAgo: 330, avail: halfDayTemplate, responseMins: 100 },
  { id: "p-tan-tutor", name: "Teacher Tan Mandarin & Maths", zone: "melawati-north", at: [10, 120], homeBased: true, radiusKm: 4, hue: 225,
    bio: "Primary school Mandarin and Maths tuition, 20 years experience.",
    services: [["tuition", "Primary Maths (Standard 1 to 6)", "Groups of 3.", 40, 50, "per hour"], ["language", "Mandarin for kids", "Conversation and reading.", 40, 50, "per hour"]],
    reviews: 36, avg: 4.8, joinedDaysAgo: 1000, avail: tuitionTemplate, responseMins: 60 },
  { id: "p-joe-handy", name: "Joe Fix-It", zone: "melawati-north", at: [70, 20], homeBased: true, radiusKm: 7, hue: 30,
    bio: "Handyman for small jobs nobody else wants: gates, hinges, shelves, curtain rails.",
    services: [["handyman", "Handyman (per visit)", "Up to 2 hours of small fixes.", 60, 120, "per visit"], ["painting", "Wall touch-up", "Patch and repaint small areas.", 80, 250, "per job"]],
    reviews: 19, avg: 4.6, joinedDaysAgo: 540, avail: weekdaysMorningAfternoon, pay: { before: false, after: true, depositPct: 0 }, responseMins: 35 },
  { id: "p-sara-eldercare", name: "Sara Caring Hands", zone: "melawati-south", at: [-60, -40], homeBased: true, radiusKm: 6, hue: 0,
    bio: "Trained caregiver. Companionship, hospital appointments and day care for older residents.",
    services: [["eldercare", "Elderly companion & appointment escort", "Half-day companion or hospital escort.", 80, 160, "per half day"]],
    reviews: 13, avg: 4.9, joinedDaysAgo: 290, avail: halfDayTemplate, responseMins: 30 },

  // ---------------- KL East ----------------
  { id: "p-sparkle-kle", name: "Shine Pro Cleaning", zone: "kleast-central", at: [-80, -60], homeBased: false, radiusKm: 10, hue: 55,
    bio: "Professional cleaners for condos and landed homes in KL East and Melawati.",
    services: [["cleaning", "Condo & landed cleaning", "3 to 5 hours, all supplies included.", 110, 180, "per visit"]],
    reviews: 22, avg: 4.95, joinedDaysAgo: 600, avail: halfDayTemplate, responseMins: 30 },
  { id: "p-priya-bake", name: "Little Oven by Divya", zone: "quarza", at: [0, 5], homeBased: true, radiusKm: 4, hue: 15,
    bio: "Baking from my Quarza unit. Brownies, cookies and small cakes. Lobby pick-up for Quarza residents.",
    services: [["cakes", "Brownies, cookies & small cakes", "Box of 9 brownies, cookie tubs, 6-inch cakes.", 28, 90, "per order"]],
    reviews: 6, avg: 4.7, past: 2, joinedDaysAgo: 75, avail: { ...pickupTemplate, blocks: [{ start: "18:00", end: "21:00" }] }, pay: { before: true, after: true, depositPct: 0 },
    social: { instagram: "littleoven.kl" }, socialVerified: true, responseMins: 15 },
  { id: "p-wei-tutor", name: "Wei Jie Physics Tutor", zone: "quarza", at: [5, -5], homeBased: true, radiusKm: 3, hue: 230,
    bio: "Engineering graduate. SPM Physics and Add Maths, one-to-one in the Quarza study room or online.",
    services: [["tuition", "SPM Physics & Add Maths", "One-to-one, 1.5 hours.", 60, 80, "per session", true]],
    reviews: 9, avg: 4.8, joinedDaysAgo: 110, avail: { ...tuitionTemplate, capacity: 1, slotMins: 90 }, pay: { before: true, after: true, depositPct: 0 }, responseMins: 25 },
  { id: "p-amir-pet", name: "Amir Dog Walker", zone: "quarza", at: [-5, 0], homeBased: true, radiusKm: 2, hue: 95,
    bio: "Daily dog walks around KL East Park. Small dogs up to 15 kg.",
    services: [["petcare", "Dog walking (45 min)", "Morning or evening walks around KL East Park.", 20, 30, "per walk"]],
    reviews: 0, avg: 0, joinedDaysAgo: 9, avail: { days: [0, 1, 2, 3, 4, 5, 6], blocks: [{ start: "07:00", end: "09:00" }, { start: "18:00", end: "20:00" }], slotMins: 45, bufferMins: 15, capacity: 2, minNoticeHrs: 4, horizonDays: 14, daysOff: [] },
    pay: { before: false, after: true, depositPct: 0 }, intro: "First walk free", responseMins: 10 },
  { id: "p-ben-it", name: "Ben Tech Help", zone: "east57", at: [10, 10], homeBased: true, radiusKm: 8, hue: 180,
    bio: "Laptop, Wi-Fi and phone setup. Patient with seniors.",
    services: [["devicerepair", "Laptop, phone & Wi-Fi help", "Slow laptop, printer setup, Wi-Fi dead spots, new phone setup.", 50, 150, "per visit"]],
    reviews: 16, avg: 4.7, joinedDaysAgo: 260, avail: eveningsWeekends, responseMins: 40 },
  { id: "p-melawati-photo", name: "Hakim Captures", zone: "kleast-central", at: [100, 40], homeBased: true, radiusKm: 20, hue: 40,
    bio: "Family, birthday and event photography.",
    services: [["photo", "Event & family photography", "2-hour session, 50 edited photos.", 300, 600, "per session"]],
    reviews: 12, avg: 4.8, joinedDaysAgo: 400, avail: { ...eveningsWeekends, days: [5, 6, 0], slotMins: 120 }, pay: { before: false, after: false, depositPct: 30 }, responseMins: 60 },

  // ---------------- Online (verified residents of SDP townships, serving anywhere) ----------------
  { id: "p-online-math", name: "Cikgu Aina Online Maths", zone: "melawati-south", at: [0, -200], homeBased: true, radiusKm: 3, hue: 250,
    bio: "Online Maths classes for Year 4 to Form 3 over Google Meet. Lives in Taman Melawati.",
    services: [["tuition", "Online Maths classes", "Small online groups, with recorded lessons.", 35, 45, "per hour", true]],
    reviews: 28, avg: 4.7, joinedDaysAgo: 500, avail: { ...tuitionTemplate, capacity: 5 }, responseMins: 30 },
  { id: "p-online-design", name: "Elmina Creative Studio", zone: "elmina-cc", at: [-100, 100], homeBased: true, radiusKm: 2, hue: 20,
    bio: "Logos, wedding cards and posters for small businesses. Works fully online.",
    services: [["design", "Graphic design", "Logo, poster, kad jemputan. 2 rounds of changes.", 80, 400, "per project", true]],
    reviews: 10, avg: 4.6, joinedDaysAgo: 220, avail: { ...weekdaysMorningAfternoon, slotMins: 30, bufferMins: 0 }, responseMins: 90 },
  { id: "p-online-quran", name: "Ustazah Hanim Online", zone: "elmina-green", at: [140, -120], homeBased: true, radiusKm: 2, hue: 140,
    bio: "Iqra and Quran reading classes for children, online.",
    services: [["quran", "Iqra & Quran reading (online)", "One-to-one, 30 minutes.", 20, 30, "per class", true]],
    reviews: 21, avg: 4.9, joinedDaysAgo: 600, avail: { ...tuitionTemplate, slotMins: 30, capacity: 1 }, responseMins: 30 },
];

interface ResidentDef {
  id: string;
  name: string;
  zone: string;
  at: [number, number];
  unit: string;
  verify?: User["verify"];
}

export const PERSONAS: { id: string; label: string; detail: string; mode: AppState["mode"] }[] = [
  { id: "u-aisyah", label: "Aisyah", detail: "Resident, Elmina Green (landed)", mode: "resident" },
  { id: "u-tan", label: "Mr Tan", detail: "Resident, Taman Melawati (landed)", mode: "resident" },
  { id: "u-priya", label: "Priya", detail: "Resident, Quarza Residence (condo)", mode: "resident" },
  { id: "p-ani", label: "Kak Ani", detail: "Provider, home baker in Elmina Green", mode: "provider" },
  { id: "p-faizal", label: "Faizal", detail: "Provider, aircond in Taman Melawati", mode: "provider" },
  { id: "u-admin", label: "Township team", detail: "Admin console", mode: "admin" },
];

const RESIDENTS: ResidentDef[] = [
  { id: "u-aisyah", name: "Aisyah Rahman", zone: "elmina-green", at: [10, 20], unit: "No. 18, Jalan Elmina Green 3" },
  { id: "u-tan", name: "Tan Wei Ming", zone: "melawati-north", at: [-20, -10], unit: "No. 7, Lorong H2" },
  { id: "u-priya", name: "Priya Nair", zone: "quarza", at: [2, 2], unit: "Tower A, 21-08" },
  { id: "u-admin", name: "Township team", zone: "elmina-cc", at: [0, 0], unit: "Management office" },
  { id: "u-pending1", name: "Daniel Lee", zone: "elmina-valley", at: [30, 30], unit: "No. 4, Jalan Elmina Valley 2", verify: "pending" },
  { id: "u-pending2", name: "Nurul Huda", zone: "quarza", at: [0, 0], unit: "Tower B, 09-11", verify: "pending" },
];

const FILLER_FIRST = ["Hui Min", "Aiman", "Kavitha", "Jason", "Nor Aini", "Suresh", "Mei Yee", "Haziq", "Ong", "Farhana", "Rajesh", "Siew Ling", "Amirul", "Grace", "Zainab", "Kelvin", "Lakshmi", "Hakimi"];

const STAR_TEXT: Record<number, string[]> = {
  5: ["Excellent, will book again.", "Came on time and very neat.", "Really happy, my family loved it.", "Very friendly and explained everything.", "Best in the area, highly recommended.", "Sedap sangat! Will order again for Raya."],
  4: ["Good job overall, slightly late.", "Good service, fair price.", "Solid work, communication could be faster.", "Bagus, tapi lambat sikit."],
  3: ["Okay but had to remind twice.", "Average, did the basics."],
  2: ["Left before finishing, had to call back.", "Not as described."],
  1: ["Did not turn up on the agreed time.", "Very poor job."],
};

function starsFor(avg: number, r: () => number): number {
  const x = avg + (r() - 0.5) * 1.6;
  return Math.max(1, Math.min(5, Math.round(x)));
}

export function buildSeed(): AppState {
  const r = rng(20261014);
  const t0 = now();
  const iso = (d: Date) => d.toISOString();

  const users: User[] = [];
  const providers: Provider[] = [];
  const services: Service[] = [];
  const bookings: Booking[] = [];
  const reviews: Review[] = [];
  const messages: Message[] = [];

  for (const d of RESIDENTS) {
    users.push({
      id: d.id, name: d.name, phone: `01${Math.floor(10000000 + r() * 89999999)}`,
      home: offset(ZONE_POINTS[d.zone], d.at[0], d.at[1]), homeLabel: ZONE_LABEL[d.zone], unit: d.unit, unitKey: `${d.zone}:${d.unit}`,
      verify: d.verify ?? "verified", verifyNote: d.verify === "pending" ? "No invite code. Uploaded a utility bill for review." : undefined,
      isProvider: false, isAdmin: d.id === "u-admin", createdAt: iso(addDays(t0, -200)), blocked: [],
    });
  }

  // Filler residents who wrote the historical reviews.
  const fillerZones = ["elmina-green", "elmina-valley", "ilham", "melawati-north", "melawati-south", "quarza", "east57", "kleast-central"];
  const fillers: User[] = [];
  fillerZones.forEach((z, zi) => {
    for (let k = 0; k < 6; k++) {
      const name = FILLER_FIRST[(zi * 6 + k) % FILLER_FIRST.length];
      const u: User = {
        id: `u-f-${z}-${k}`, name, phone: `01${Math.floor(10000000 + r() * 89999999)}`,
        home: offset(ZONE_POINTS[z], (r() - 0.5) * 300, (r() - 0.5) * 300), homeLabel: ZONE_LABEL[z], unit: `Unit ${k + 1}`, unitKey: `${z}:filler-${k}`,
        verify: "verified", isProvider: false, isAdmin: false, createdAt: iso(addDays(t0, -365)), blocked: [],
      };
      fillers.push(u);
    }
  });
  users.push(...fillers);

  let bookingSeq = 1;
  for (const d of PROVIDERS) {
    const exact = offset(ZONE_POINTS[d.zone], d.at[0], d.at[1]);
    users.push({
      id: d.id, name: d.name, phone: `01${Math.floor(10000000 + r() * 89999999)}`, home: exact, homeLabel: ZONE_LABEL[d.zone],
      unit: "Private", unitKey: `${d.zone}:${d.id}`, verify: "verified", isProvider: true, isAdmin: false,
      createdAt: iso(addDays(t0, -d.joinedDaysAgo)), blocked: [],
    });
    providers.push({
      id: d.id, displayName: d.name, bio: d.bio, hue: d.hue, homeBased: d.homeBased, exact, serviceRadiusKm: d.radiusKm,
      social: d.social ?? {}, socialVerified: d.socialVerified ?? false, socialCode: `JL-${d.id.slice(2, 6).toUpperCase()}`,
      joinedAt: iso(addDays(t0, -d.joinedDaysAgo)), responseMins: d.responseMins,
      payment: { before: true, after: true, depositPct: 0, ...d.pay }, introOffer: d.intro,
      availability: JSON.parse(JSON.stringify(d.avail)), active: true, hidden: false,
    });
    d.services.forEach((s, i) => {
      services.push({ id: `${d.id}-s${i + 1}`, providerId: d.id, categoryId: s[0], title: s[1], description: s[2], priceMin: s[3], priceMax: s[4], priceUnit: s[5], online: !!s[6] });
    });

    // Historical completed bookings with reviews.
    const townOf = (z: string) => zoneById(z)?.townshipId ?? "elsewhere";
    const providerTown = townOf(d.zone);
    // Reviewers come from the provider's own township, or the neighbouring one for Melawati and KL East.
    const near = (t: string) => t === providerTown || (providerTown !== "elmina" && t !== "elmina" && t !== "elsewhere");
    const sameTown = fillers.filter((f) => near(townOf(f.unitKey.split(":")[0])));
    const pastPool = fillers.filter((f) => townOf(f.unitKey.split(":")[0]) === providerTown);
    for (let k = 0; k < d.reviews; k++) {
      const author = sameTown[Math.floor(r() * sameTown.length)];
      const svc = services.find((s) => s.providerId === d.id)!;
      const daysAgo = Math.min(d.joinedDaysAgo - 1, Math.floor(r() * d.joinedDaysAgo));
      const start = atTime(addDays(startOfDay(t0), -daysAgo - 1), "10:00");
      const id = `b-h${bookingSeq++}`;
      const stars = k === 0 && d.reviews === 1 ? Math.round(d.avg) : starsFor(d.avg, r);
      const price = Math.round(svc.priceMin + r() * (svc.priceMax - svc.priceMin));
      bookings.push({
        id, residentId: author.id, providerId: d.id, serviceId: svc.id, start: iso(start), end: iso(addMinutes(start, d.avail.slotMins)),
        status: "reviewed", holdExpiresAt: iso(start), message: "", agreedDetails: svc.title, price, paymentMode: "after",
        payment: "paid", amountPaid: price, paymentMethod: "FPX (demo)", doneByProvider: true, doneByResident: true, createdAt: iso(addDays(start, -2)),
        events: [{ at: iso(start), by: "system", text: "Completed" }],
      });
      const texts = STAR_TEXT[stars];
      reviews.push({ id: `rv-${id}`, providerId: d.id, authorId: author.id, bookingId: id, type: "booked", stars, text: texts[Math.floor(r() * texts.length)], at: iso(addDays(start, 1)) });
    }
    for (let k = 0; k < (d.past ?? 0); k++) {
      const author = pastPool[(k * 5 + 3) % pastPool.length];
      reviews.push({
        id: `rv-past-${d.id}-${k}`, providerId: d.id, authorId: author.id, type: "past", stars: 5,
        text: ["Been buying from her for years before this app. Always consistent.", "Neighbour for a long time, reliable and honest.", "Ordered many times through WhatsApp, never disappointed."][k % 3],
        at: iso(addDays(t0, -Math.floor(5 + r() * 15))),
      });
    }
  }

  // Live demo bookings.
  const day = (n: number, hhmm: string) => atTime(addDays(startOfDay(t0), n), hhmm);
  const mk = (b: Partial<Booking> & Pick<Booking, "id" | "residentId" | "providerId" | "serviceId" | "start" | "end" | "status">): Booking => ({
    holdExpiresAt: iso(addMinutes(t0, 60 * 20)), message: "", agreedDetails: "", price: 0, payment: "unpaid", amountPaid: 0,
    doneByProvider: false, doneByResident: false, createdAt: iso(addMinutes(t0, -90)), events: [], ...b,
  });

  // Aisyah: confirmed cleaning from Elmina Valley next week (gate pass), and a completed cake order waiting for a review.
  const nextSat = (() => { let n = 1; while (addDays(t0, n).getDay() !== 6) n++; return n; })();
  const nextTue = (() => { let n = 2; while (addDays(t0, n).getDay() !== 2) n++; return n; })();
  bookings.push(mk({
    id: "b-demo-clean", residentId: "u-aisyah", providerId: "p-siti", serviceId: "p-siti-s1", start: iso(day(nextTue, "08:30")), end: iso(day(nextTue, "12:30")),
    status: "confirmed", message: "Hi, need a full clean for a 2-storey terrace before my in-laws visit.", agreedDetails: "4-hour clean, 2-storey terrace, includes kitchen degrease",
    price: 150, paymentMode: "before", payment: "held", amountPaid: 150, paymentMethod: "DuitNow QR (demo)", gatePassId: "gp-demo-clean",
    events: [{ at: iso(addMinutes(t0, -300)), by: "u-aisyah", text: "Requested" }, { at: iso(addMinutes(t0, -240)), by: "p-siti", text: "Accepted at RM150" }, { at: iso(addMinutes(t0, -200)), by: "u-aisyah", text: "Confirmed and paid RM150 (held)" }],
  }));
  bookings.push(mk({
    id: "b-demo-cake", residentId: "u-aisyah", providerId: "p-ani", serviceId: "p-ani-s1", start: iso(day(-2, "16:00")), end: iso(day(-2, "17:00")),
    status: "completed", message: "1 kg chocolate moist for my son's 7th birthday, write 'Selamat Hari Jadi Adam'.", agreedDetails: "1 kg chocolate moist with name, pick-up",
    price: 95, paymentMode: "deposit", payment: "paid", amountPaid: 95, paymentMethod: "FPX (demo)", doneByProvider: true, doneByResident: true,
    events: [{ at: iso(day(-4, "10:00")), by: "u-aisyah", text: "Requested" }, { at: iso(day(-2, "17:00")), by: "system", text: "Completed" }],
  }));
  // Priya: a pending request to the dog walker in her building.
  bookings.push(mk({
    id: "b-demo-walk", residentId: "u-priya", providerId: "p-amir-pet", serviceId: "p-amir-pet-s1", start: iso(day(1, "18:00")), end: iso(day(1, "18:45")),
    status: "requested", message: "Hi Amir, I have a 9 kg poodle, Mochi. Evening walk tomorrow?", events: [{ at: iso(addMinutes(t0, -40)), by: "u-priya", text: "Requested" }],
  }));
  // Kak Ani (provider persona): one new request from a neighbour, one accepted waiting for the customer.
  bookings.push(mk({
    id: "b-demo-ani-req", residentId: "u-f-elmina-valley-1", providerId: "p-ani", serviceId: "p-ani-s2", start: iso(day(nextSat, "10:00")), end: iso(day(nextSat, "11:00")),
    status: "requested", message: "Hi kak, 100 pieces kuih for doa selamat on Saturday morning. Mix of seri muka and karipap?", events: [{ at: iso(addMinutes(t0, -25)), by: "u-f-elmina-valley-1", text: "Requested" }],
  }));
  // Faizal (provider persona): confirmed job for tomorrow, pay after.
  bookings.push(mk({
    id: "b-demo-faizal", residentId: "u-f-melawati-north-2", providerId: "p-faizal", serviceId: "p-faizal-s1", start: iso(day(1, "09:00")), end: iso(day(1, "10:30")),
    status: "confirmed", message: "2 units not cold, one dripping water.", agreedDetails: "Chemical wash x2 units", price: 300, paymentMode: "after", payment: "unpaid",
    events: [{ at: iso(addMinutes(t0, -600)), by: "u-f-melawati-north-2", text: "Requested" }, { at: iso(addMinutes(t0, -500)), by: "p-faizal", text: "Accepted at RM300" }, { at: iso(addMinutes(t0, -480)), by: "u-f-melawati-north-2", text: "Confirmed, pay after" }],
  }));

  const msg = (threadId: string, fromId: string, text: string, minsAgo: number): Message => ({ id: `m-${threadId}-${minsAgo}`, threadId, fromId, text, at: iso(addMinutes(t0, -minsAgo)) });
  messages.push(
    msg("b:b-demo-clean", "u-aisyah", "Hi, need a full clean for a 2-storey terrace before my in-laws visit.", 300),
    msg("b:b-demo-clean", "p-siti", "Boleh! RM150 for 4 hours, two of us. Kitchen degrease included.", 250),
    msg("b:b-demo-clean", "u-aisyah", "Great, confirmed. Gate pass will be sent to you automatically.", 200),
    msg("b:b-demo-walk", "u-priya", "Hi Amir, I have a 9 kg poodle, Mochi. Evening walk tomorrow?", 40),
    msg("b:b-demo-ani-req", "u-f-elmina-valley-1", "Hi kak, 100 pieces kuih for doa selamat on Saturday morning. Mix of seri muka and karipap?", 25),
  );

  const requests: RequestPost[] = [
    { id: "r-1", residentId: "u-f-elmina-green-2", text: "Looking for someone to fetch my son from SK Bukit Subang on Tue and Thu at 1pm and watch him until 6pm.", categoryId: "childcare", timeHint: "Tue & Thu afternoons", createdAt: iso(addMinutes(t0, -600)), status: "open",
      responses: [{ providerId: "p-zul-errand", text: "I can do the school pick-up, but not the babysitting part. Happy to help with transport.", at: iso(addMinutes(t0, -400)) }] },
    { id: "r-2", residentId: "u-f-melawati-south-1", text: "Auto gate motor making grinding noise and stopping halfway. Anyone in Melawati fixes this?", categoryId: "handyman", timeHint: "This week", createdAt: iso(addMinutes(t0, -200)), status: "open", responses: [] },
    { id: "r-3", residentId: "u-f-quarza-3", text: "Need someone to water plants and feed my cat while I'm away 5 days next month.", categoryId: "petcare", timeHint: "Next month", createdAt: iso(addMinutes(t0, -1500)), status: "open", responses: [] },
  ];

  const promotions: Promotion[] = [
    { id: "pr-1", sponsor: "Elmina Lakeside Mall", source: "mall", townshipId: "elmina", title: "Weekend family day at the lake", body: "Kids' activities and food trucks, Saturday 10am to 4pm. Sample promotion.", active: true, impressions: 0, clicks: 0 },
    { id: "pr-2", sponsor: "City of Elmina", source: "event", townshipId: "elmina", title: "Central Park community run", body: "5 km fun run for residents, register at the management office. Sample promotion.", active: true, impressions: 0, clicks: 0 },
    { id: "pr-3", sponsor: "KL East Mall", source: "mall", townshipId: "kleast", title: "Residents' week deals", body: "Show your JiranLink resident badge at participating tenants for member offers. Sample promotion.", active: true, impressions: 0, clicks: 0 },
    { id: "pr-4", sponsor: "KL East Mall", source: "mall", townshipId: "melawati", title: "Back-to-school fair", body: "Stationery and uniform stalls, this weekend. Sample promotion.", active: true, impressions: 0, clicks: 0 },
    { id: "pr-5", sponsor: "Sime Darby Property", source: "launch", townshipId: "kleast", title: "New homes preview in KL East", body: "Visit the sales gallery for the latest launch. Sample promotion.", active: false, impressions: 0, clicks: 0 },
  ];

  return {
    version: 4, users, providers, services, bookings, messages, reviews, requests, promotions,
    reports: [{ id: "rep-1", reporterId: "u-f-elmina-valley-3", providerId: "p-sparkle", reason: "Did not turn up twice and kept the deposit.", at: iso(addDays(t0, -3)), status: "open" }],
    pastInvites: [{ code: "ANI-OLD-7Q2", providerId: "p-ani", createdAt: iso(addDays(t0, -20)), usedBy: [] }],
    gatePasses: [{ id: "gp-demo-clean", bookingId: "b-demo-clean", visitorName: "Siti Kemas Rumah (2 persons)", zoneName: "Elmina Green", hostLabel: "Aisyah R.", validFrom: iso(addMinutes(day(nextTue, "08:30"), -30)), validTo: iso(addMinutes(day(nextTue, "12:30"), 30)) }],
    inviteCodes: [
      { code: "ELM-GRN-1024", unitKey: "elmina-green:No. 22, Jalan Elmina Green 3", zoneId: "elmina-green" },
      { code: "QRZ-12A-0705", unitKey: "quarza:Tower A, 12-05", zoneId: "quarza" },
      { code: "MLW-N-0331", unitKey: "melawati-north:No. 31, Lorong H3", zoneId: "melawati-north" },
    ],
    config: { ...DEFAULT_CONFIG },
    currentUserId: "u-aisyah",
    mode: "resident",
  };
}

export { ZONE_POINTS };
