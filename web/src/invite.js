// An invite as a link anyone can open (#/invite?id=...), also someone with no account yet: the link shows the game,
// sign-in remembers it in this browser, and the member is joined as soon as they are in.
const KEY = "serve.pendingInvite";

export const inviteLink = (id) => `${location.origin}${location.pathname}#/invite?id=${encodeURIComponent(id)}`;

// the phone's share sheet where there is one, else the link copied; says which
export async function shareInvite(id, text = "Join my game on Serve") {
  const url = inviteLink(id);
  if (navigator.share) { try { await navigator.share({ title: "Serve", text, url }); return "shared"; } catch (e) { if (e?.name === "AbortError") return null; } }
  try { await navigator.clipboard.writeText(url); return "copied"; } catch { window.prompt("Copy this link", url); return "copied"; }
}

export const pendingInvite = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(id) { try { localStorage.setItem(KEY, id); } catch { /* the link still works, without the auto-join */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* nothing kept */ } },
};
