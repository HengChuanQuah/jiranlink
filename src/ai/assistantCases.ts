// Questions used by Admin > AI check to test the assistant against the live AI.
// "tool" is the tool a correct answer should use; "args" lists acceptable values.

export interface AssistantCase {
  q: string;
  tool: "find_providers" | "get_help" | "my_bookings" | "draft_request" | "none" | "find_or_draft";
  accept?: string[]; // acceptable category_id / topic values
}

export const ASSISTANT_CASES: AssistantCase[] = [
  { q: "I want someone to fix the pipes, who can do it?", tool: "find_providers", accept: ["plumbing"] },
  { q: "how do i request for a specific skill that is not listed?", tool: "get_help", accept: ["request_board"] },
  { q: "siling rumah ada tompok coklat makin besar", tool: "find_providers", accept: ["plumbing", "handyman", "painting"] },
  { q: "macam mana nak bayar lepas kerja siap?", tool: "get_help", accept: ["pay_after_rule", "payment_options"] },
  { q: "anak saya perlukan cikgu add maths form 4", tool: "find_providers", accept: ["tuition"] },
  { q: "我家的冷气不冷了，可以找谁？", tool: "find_providers", accept: ["aircond"] },
  { q: "what's happening with my bookings?", tool: "my_bookings" },
  { q: "need someone to assemble my IKEA wardrobe this weekend", tool: "find_providers", accept: ["handyman", "moving"] },
  { q: "how does JiranLink decide who shows up first?", tool: "get_help", accept: ["ranking"] },
  { q: "how can I start selling my kuih here?", tool: "get_help", accept: ["become_provider"] },
  { q: "can I cancel after I paid?", tool: "get_help", accept: ["cancelling"] },
  { q: "looking for someone to teach my mother how to use WhatsApp video call", tool: "find_or_draft", accept: ["devicerepair", "coding"] },
  { q: "who won the football match last night?", tool: "none" },
];
