// The agents' faces: one picture per agent of the demo club, and one for your own agent, made once with Meta's Muse
// Image (muse-image-1.0) and kept in public/agents/. An agent without one (a new member's) keeps the initials.
const MADE = new Set(["you", "hana", "ravi", "tomas", "yuki", "aisha", "leo", "noor", "sam", "ines", "kenji", "priya"]);
export const agentFace = (id) => (MADE.has(id) ? `/agents/${id}.png` : null);
