import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Safe client — uses placeholder values when env vars are missing so the
// app never crashes on import. All DB calls simply return errors which
// the helpers below handle gracefully.
export const supabase = createClient(
  SUPABASE_URL      ?? "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY ?? "placeholder-key",
);

/* ── Sign Up ──────────────────────────────────────── */
export async function signUp(email: string, password: string, name: string) {
  if (!SUPABASE_CONFIGURED) return { data: null, error: { message: "Supabase not configured — add your keys to .env.local" } as any };
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
}

/* ── Sign In (email + password) ───────────────────── */
export async function signIn(email: string, password: string) {
  if (!SUPABASE_CONFIGURED) return { data: null, error: { message: "Supabase not configured" } as any };
  return supabase.auth.signInWithPassword({ email, password });
}

/* ── Sign In with Google (OAuth) ─────────────────── */
export async function signInWithGoogle() {
  if (!SUPABASE_CONFIGURED) return { data: null, error: { message: "Supabase not configured" } as any };
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  });
}

/* ── Send password reset email ───────────────────── */
export async function sendPasswordReset(email: string) {
  if (!SUPABASE_CONFIGURED) return { error: { message: "Supabase not configured" } as any };
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

/* ── Update password (after reset link) ─────────── */
export async function updatePassword(newPassword: string) {
  if (!SUPABASE_CONFIGURED) return { error: { message: "Supabase not configured" } as any };
  return supabase.auth.updateUser({ password: newPassword });
}

/* ── Update profile (name / email / avatar URL) ──── */
export async function updateProfile(fields: {
  full_name?: string;
  email?: string;
  avatar_url?: string;
}) {
  if (!SUPABASE_CONFIGURED) return { error: { message: "Supabase not configured" } as any };
  const update: Parameters<typeof supabase.auth.updateUser>[0] = {};
  if (fields.email) update.email = fields.email;
  if (fields.full_name || fields.avatar_url) {
    update.data = {};
    if (fields.full_name) update.data.full_name = fields.full_name;
    if (fields.avatar_url) update.data.avatar_url = fields.avatar_url;
  }
  return supabase.auth.updateUser(update);
}

function appendCacheBust(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

/* ── Upload avatar to Supabase Storage ───────────── */
export async function uploadAvatar(file: File): Promise<string | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) { console.error("uploadAvatar:", error.message); return null; }
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl ? appendCacheBust(data.publicUrl) : null;
}

/* ── Sign Out ─────────────────────────────────────── */
export async function signOut() {
  if (!SUPABASE_CONFIGURED) return;
  await supabase.auth.signOut();
}

/* ── Session / User ──────────────────────────────── */
export async function getSession() {
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/* ── Reactive avatar cache ───────────────────────────
   Any component that calls setAvatarCache() (e.g. ProfilePage after
   uploading a new photo) will instantly update all subscribers
   (Dashboard, CoursePage) without a page reload.
──────────────────────────────────────────────────── */
let _avatarUrl: string | null = null;
const _avatarListeners = new Set<(url: string | null) => void>();

export function getAvatarCache(): string | null { return _avatarUrl; }

export function setAvatarCache(url: string | null) {
  _avatarUrl = url;
  _avatarListeners.forEach(cb => cb(url));
}

/** Subscribe to avatar changes. Returns an unsubscribe function. */
export function subscribeToAvatar(cb: (url: string | null) => void): () => void {
  _avatarListeners.add(cb);
  cb(_avatarUrl);
  return () => { _avatarListeners.delete(cb); };
}

/* ── Custom Avatar Persistence (survives OAuth re-login) ────
   We store the user-uploaded avatar URL in localStorage so that
   Google OAuth re-login (which overwrites user_metadata.avatar_url
   with Google's profile photo) cannot remove the custom picture.
──────────────────────────────────────────────────────────── */
const customAvatarKey = (userId: string) => `lb_custom_avatar_${userId}`;

/** Save a custom-uploaded avatar URL keyed by Supabase user ID. */
export function saveCustomAvatarUrl(userId: string, url: string | null): void {
  try {
    if (url) localStorage.setItem(customAvatarKey(userId), url);
    else localStorage.removeItem(customAvatarKey(userId));
  } catch { /* ignore — localStorage may be unavailable */ }
}

/** Load the previously saved custom avatar URL for a user. */
export function loadCustomAvatarUrl(userId: string): string | null {
  try { return localStorage.getItem(customAvatarKey(userId)); } catch { return null; }
}

export function resolvePreferredAvatarUrl(userId: string, fallbackUrl?: string | null): string | null {
  return loadCustomAvatarUrl(userId) ?? fallbackUrl ?? null;
}

/**
 * Call once at app start. Listens for auth state changes (e.g. Google
 * OAuth re-login) and automatically restores the custom avatar to
 * Supabase user_metadata if it was overwritten.
 */
export function initAvatarRestoreOnLogin(): void {
  if (!SUPABASE_CONFIGURED) return;

  void supabase.auth.getSession().then(({ data }) => {
    const user = data.session?.user;
    if (!user) return;
    const preferred = resolvePreferredAvatarUrl(user.id, user.user_metadata?.avatar_url ?? null);
    setAvatarCache(preferred);
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) return;
    const userId = session.user.id;
    const stored = loadCustomAvatarUrl(userId);
    const preferred = resolvePreferredAvatarUrl(userId, session.user.user_metadata?.avatar_url ?? null);
    if (!preferred) return;
    setAvatarCache(preferred);

    // Restore custom avatar to Supabase metadata when Google OAuth overwrites it.
    // Guard against infinite loop: only call updateUser when metadata differs from
    // what we want — the next USER_UPDATED event will have matching metadata, so
    // the guard will be false and updateUser won't be called again.
    if (stored && (session.user.user_metadata?.avatar_url ?? null) !== stored) {
      void supabase.auth.updateUser({ data: { avatar_url: stored } }).catch(() => {});
    }
  });
}

export type { User, Session } from "@supabase/supabase-js";
