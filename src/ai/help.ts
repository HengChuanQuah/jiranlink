// JiranLink's official help text. The assistant answers "how do I…" questions only from this,
// so keep it accurate whenever a feature changes.

import type { Route } from "../lib/router";
import type { HelpTopic } from "./spec";

export interface HelpAction {
  label: string;
  route: Route;
}

export interface HelpEntry {
  title: string;
  text: string;
  actions: HelpAction[];
  /** Words for the offline quick answer (English, Malay, Chinese). "~" marks a weak, generic word. */
  keywords: string[];
}

export const HELP: Record<HelpTopic, HelpEntry> = {
  how_to_search: {
    title: "Finding a service",
    text: "Type what you need on Home in your own words, in English, Malay, Chinese or Manglish, for example \"aircond bocor air\". JiranLink shows neighbours closest to you first. On the results page you can switch to Top rated or Map.",
    actions: [{ label: "Go to Home", route: { name: "home" } }],
    keywords: ["search", "find", "cari", "look for", "搜索", "找"],
  },
  booking_steps: {
    title: "How booking works",
    text: "Open a provider, tap Book on a service, pick a free slot and send a short message. The slot is held for 24 hours. The provider accepts with a price, offers another time, or declines. You then confirm and choose how to pay. After the job, you both tap Job done, and you can leave a review.",
    actions: [{ label: "My bookings", route: { name: "bookings" } }],
    keywords: ["~book", "~booking", "~tempah", "slot", "appointment", "how to book", "预约", "预订"],
  },
  payment_options: {
    title: "Ways to pay",
    text: "Each provider chooses what they accept: pay now (JiranLink holds the money until you both tap Job done), pay after the job, or a deposit now and the rest after. You choose when you confirm the booking. Payments in this test build are simulated, so no money moves.",
    actions: [{ label: "My bookings", route: { name: "bookings" } }],
    keywords: ["~pay", "~payment", "~bayar", "fpx", "duitnow", "card", "deposit", "付款", "付钱"],
  },
  pay_after_rule: {
    title: "Paying after the job",
    text: "If you pay after the job, the amount becomes due once you both tap Job done. Until it's paid, you can't make new bookings. Providers can see each customer's record of completed, unpaid and cancelled jobs before accepting.",
    actions: [{ label: "My bookings", route: { name: "bookings" } }],
    keywords: ["pay after", "bayar lepas", "lepas siap", "owe", "unpaid", "due", "hutang", "之后付"],
  },
  cancelling: {
    title: "Cancelling",
    text: "You can cancel a request while it's waiting, or a confirmed booking before it starts, from the booking's page. Anything you paid in advance is refunded automatically. This test build has no cancellation fees.",
    actions: [{ label: "My bookings", route: { name: "bookings" } }],
    keywords: ["cancel", "batal", "refund", "pulang duit", "取消", "退款"],
  },
  request_board: {
    title: "The request board",
    text: "If nobody offers what you need, post it on the Requests board in your own words. JiranLink tags the type of service automatically, and verified providers within 10 km can reply. You can chat with anyone who replies and open their profile to book.",
    actions: [{ label: "Open the request board", route: { name: "requests" } }],
    keywords: ["request", "post", "not listed", "tiada", "takde", "skill", "minta", "board", "发布", "请求"],
  },
  reviews: {
    title: "Reviews and ratings",
    text: "You can review a provider after a booking is completed. Those reviews are labelled \"Booked via JiranLink\" and count fully. Search uses an adjusted rating that starts everyone near 4 stars, so one or two reviews can't swing it too far.",
    actions: [{ label: "My bookings", route: { name: "bookings" } }],
    keywords: ["review", "rating", "star", "ulasan", "bintang", "评价", "评分"],
  },
  past_customer_reviews: {
    title: "Reviewing someone you used before",
    text: "If you used a neighbour before JiranLink, ask them for their invite code and enter it under Me. These reviews are labelled \"Past customer\" and count at half weight, with at most 5 counted. Only residents of the same township can write them, one per home.",
    actions: [{ label: "Go to Me", route: { name: "profile" } }],
    keywords: ["invite code", "past customer", "before jiranlink", "kod", "pelanggan lama", "以前"],
  },
  verification: {
    title: "Joining and verification",
    text: "Only verified residents can book. Sign up with your phone number and your home. An invite code from your management office verifies you instantly; without one, the township team checks your residence. One phone number per home and at most 4 members per home. No IC number is needed.",
    actions: [{ label: "Go to Me", route: { name: "profile" } }],
    keywords: ["sign up", "register", "verify", "verification", "daftar", "sah", "ic", "注册", "验证"],
  },
  become_provider: {
    title: "Offering your own service",
    text: "Go to Me and tap Start offering a service (your home must be verified). Add your services and prices, then set your working hours. Neighbours in your building and precinct see you first. New providers get a \"New\" badge and a newcomer spot in search for their first 10 reviews or 90 days.",
    actions: [{ label: "Go to Me", route: { name: "profile" } }],
    keywords: ["provider", "sell", "offer", "jual", "berniaga", "become", "my own service", "kuih", "卖", "提供服务"],
  },
  provider_hours: {
    title: "Providers' hours and slots",
    text: "Providers set their working days, time blocks, slot length, breaks between jobs, bookings per slot, minimum notice and days off. JiranLink turns these into bookable slots and hides any that are already taken.",
    actions: [],
    keywords: ["hours", "slot", "schedule", "masa", "jadual", "时间"],
  },
  visitor_pass: {
    title: "Visitor pass for gated homes",
    text: "If you live in a gated building or precinct and the provider lives outside it, confirming the booking creates a visitor pass with a QR code for the guardhouse, valid around the booking time. In this test build the pass is a demo only.",
    actions: [{ label: "My bookings", route: { name: "bookings" } }],
    keywords: ["gate", "guard", "pass", "qr", "pengawal", "pondok", "门卡", "保安"],
  },
  ranking: {
    title: "Who shows first",
    text: "Results go in rings: your building, your precinct, your township, then 2, 5 and 10 km. Search stops widening once it finds 5 good providers. Providers rated below 3.5 are hidden unless they have fewer than 3 reviews. One newcomer gets a spot near the top, and one much better provider slightly further away may show as a separate card. Sponsored promotions never change the order.",
    actions: [],
    keywords: ["first", "rank", "order", "nearest", "kenapa", "why", "dulu", "排名"],
  },
  safety_report_block: {
    title: "Safety, reporting and blocking",
    text: "Every resident and provider is verified to a real home. On any provider's profile you can Report them to the township team, or Block them so they never appear in your results. Keep chats inside JiranLink.",
    actions: [],
    keywords: ["safe", "report", "block", "scam", "selamat", "lapor", "安全", "举报"],
  },
  messages: {
    title: "Messages",
    text: "Each booking has its own chat with the provider, and you can also chat with providers who replied to your request. All conversations are under Messages.",
    actions: [{ label: "Open Messages", route: { name: "messages" } }],
    keywords: ["message", "chat", "mesej", "contact", "hubungi", "聊天", "联系"],
  },
};
