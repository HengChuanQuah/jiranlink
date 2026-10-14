export type LatLng = [number, number];

export type ZoneType = "building" | "precinct" | "township";

export interface Township {
  id: string;
  name: string;
  center: LatLng;
  blurb: string;
  mall: string;
}

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  townshipId: string;
  parentId: string | null;
  gated: boolean;
  polygon: LatLng[];
}

export type VerifyStatus = "verified" | "pending" | "unverified";

export interface User {
  id: string;
  name: string;
  phone: string;
  home: LatLng;
  homeLabel: string;
  unit: string; // private, never shown to other users
  unitKey: string; // building or street + unit, used for "one account per unit" rules
  verify: VerifyStatus;
  verifyNote?: string;
  isProvider: boolean;
  isAdmin: boolean;
  createdAt: string;
  blocked: string[]; // provider ids this user has blocked
}

export interface AvailabilityBlock {
  start: string; // "09:00"
  end: string; // "12:00"
}

export interface AvailabilityTemplate {
  days: number[]; // 0 = Sunday
  blocks: AvailabilityBlock[];
  slotMins: number;
  bufferMins: number;
  capacity: number;
  minNoticeHrs: number;
  horizonDays: number;
  daysOff: string[]; // "YYYY-MM-DD"
}

export interface PaymentOptions {
  before: boolean;
  after: boolean;
  depositPct: number; // 0 = no deposit option
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface Provider {
  id: string; // same as user id
  displayName: string;
  bio: string;
  hue: number; // avatar colour
  homeBased: boolean; // true: location shown as a blurred area
  exact: LatLng; // private
  serviceRadiusKm: number;
  social: SocialLinks;
  socialVerified: boolean;
  socialCode: string;
  joinedAt: string;
  responseMins: number;
  payment: PaymentOptions;
  introOffer?: string;
  availability: AvailabilityTemplate;
  active: boolean;
  hidden: boolean; // hidden by admin after a report
}

export interface Service {
  id: string;
  providerId: string;
  categoryId: string;
  title: string;
  description: string;
  priceMin: number;
  priceMax: number;
  priceUnit: string;
  online: boolean;
}

export type BookingStatus =
  | "requested"
  | "accepted"
  | "confirmed"
  | "completed"
  | "reviewed"
  | "declined"
  | "cancelled"
  | "expired";

export type PaymentMode = "before" | "after" | "deposit";
export type PaymentStatus = "unpaid" | "held" | "deposit_held" | "due" | "paid" | "released" | "refunded";

export interface BookingEvent {
  at: string;
  by: string; // user id or "system"
  text: string;
}

export interface Booking {
  id: string;
  residentId: string;
  providerId: string;
  serviceId: string;
  start: string; // ISO
  end: string;
  status: BookingStatus;
  holdExpiresAt: string;
  message: string;
  agreedDetails: string;
  price: number;
  proposedStart?: string;
  paymentMode?: PaymentMode;
  payment: PaymentStatus;
  amountPaid: number;
  paymentMethod?: string;
  doneByProvider: boolean;
  doneByResident: boolean;
  gatePassId?: string;
  createdAt: string;
  events: BookingEvent[];
}

export interface Message {
  id: string;
  threadId: string; // "b:<bookingId>" or "r:<requestId>:<providerId>"
  fromId: string;
  text: string;
  at: string;
}

export type ReviewType = "booked" | "past";

export interface Review {
  id: string;
  providerId: string;
  authorId: string;
  bookingId?: string;
  type: ReviewType;
  stars: number;
  text: string;
  at: string;
}

export interface RequestResponse {
  providerId: string;
  text: string;
  at: string;
}

export interface RequestPost {
  id: string;
  residentId: string;
  text: string;
  categoryId: string | null;
  timeHint: string;
  createdAt: string;
  status: "open" | "closed";
  responses: RequestResponse[];
}

export interface Promotion {
  id: string;
  sponsor: string;
  source: "mall" | "event" | "launch";
  townshipId: string;
  title: string;
  body: string;
  active: boolean;
  impressions: number;
  clicks: number;
}

export interface Report {
  id: string;
  reporterId: string;
  providerId: string;
  reason: string;
  at: string;
  status: "open" | "dismissed" | "actioned";
}

export interface PastInvite {
  code: string;
  providerId: string;
  createdAt: string;
  usedBy: string[];
}

export interface GatePass {
  id: string;
  bookingId: string;
  visitorName: string;
  zoneName: string;
  hostLabel: string;
  validFrom: string;
  validTo: string;
}

export type AiProvider = "none" | "gemini" | "claude";

export interface Config {
  qualityFloor: number;
  floorExemptReviews: number;
  newMaxReviews: number;
  newMaxDays: number;
  priorMean: number;
  priorWeight: number;
  pastWeight: number;
  pastMax: number;
  targetResults: number;
  ringsKm: number[];
  exceptionStarGap: number;
  exceptionMinReviews: number;
  holdHours: number;
  aiConfident: number;
  aiLead: number;
  aiLost: number;
  aiProvider: AiProvider;
  aiModel: string;
  aiKey: string;
  mapsKey: string;
}

export interface InviteCode {
  code: string;
  unitKey: string;
  zoneId: string;
  usedBy?: string;
}

export interface AppState {
  version: number;
  users: User[];
  providers: Provider[];
  services: Service[];
  bookings: Booking[];
  messages: Message[];
  reviews: Review[];
  requests: RequestPost[];
  promotions: Promotion[];
  reports: Report[];
  pastInvites: PastInvite[];
  gatePasses: GatePass[];
  inviteCodes: InviteCode[];
  config: Config;
  currentUserId: string;
  mode: "resident" | "provider" | "admin";
}
