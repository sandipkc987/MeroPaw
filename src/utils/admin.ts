const ADMIN_DOMAIN_ALLOWLIST = ["meropaw.com"];
const ADMIN_EMAIL_ALLOWLIST = ["sandipkc987@gmail.com"];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (ADMIN_EMAIL_ALLOWLIST.includes(normalized)) return true;
  const domain = normalized.split("@")[1];
  return !!domain && ADMIN_DOMAIN_ALLOWLIST.includes(domain);
}
