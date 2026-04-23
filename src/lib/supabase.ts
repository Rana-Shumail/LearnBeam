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

export async function fetchRemoteAvatarPreference(userId: string): Promise<string | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("avatar_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return typeof data?.avatar_url === "string" && data.avatar_url.trim() ? data.avatar_url.trim() : null;
}

export async function saveRemoteAvatarPreference(userId: string, url: string | null): Promise<void> {
  if (!SUPABASE_CONFIGURED) return;
  const { error } = await supabase
    .from("user_profiles")
    .upsert({
      user_id: userId,
      avatar_url: url,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  if (error) throw error;
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
let _avatarRestoreInitialized = false;

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

function extractMetadataAvatarUrl(metadata: Record<string, unknown> | undefined): string | null {
  const avatar = typeof metadata?.avatar_url === "string" ? metadata.avatar_url : null;
  const picture = typeof metadata?.picture === "string" ? metadata.picture : null;
  return avatar ?? picture ?? null;
}

async function restoreAvatarForUser(user: { id: string; user_metadata?: Record<string, unknown> }): Promise<void> {
  const fallback = extractMetadataAvatarUrl(user.user_metadata);
  const stored = loadCustomAvatarUrl(user.id);
  const preferredLocal = resolvePreferredAvatarUrl(user.id, fallback);
  if (preferredLocal) {
    setAvatarCache(preferredLocal);
  }

  const remote = await fetchRemoteAvatarPreference(user.id).catch(() => null);
  const preferred = remote ?? preferredLocal;
  setAvatarCache(preferred);

  if (preferred && stored !== preferred) {
    saveCustomAvatarUrl(user.id, preferred);
  }
  if (!remote && preferred) {
    void saveRemoteAvatarPreference(user.id, preferred).catch(() => {});
  }
}

/**
 * Call once at app start. Listens for auth state changes (e.g. Google
 * OAuth re-login) and automatically restores the custom avatar to
 * Supabase user_metadata if it was overwritten.
 */
export function initAvatarRestoreOnLogin(): void {
  if (!SUPABASE_CONFIGURED || _avatarRestoreInitialized) return;
  _avatarRestoreInitialized = true;

  void supabase.auth.getSession().then(({ data }) => {
    const user = data.session?.user;
    if (!user) return;
    window.setTimeout(() => {
      void restoreAvatarForUser(user);
    }, 0);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      setAvatarCache(null);
      return;
    }
    window.setTimeout(() => {
      void restoreAvatarForUser(session.user);
    }, 0);
  });
}

export type { User, Session } from "@supabase/supabase-js";
