// @ts-nocheck
export const __name = (fn, name) => Object.defineProperty(fn, "name", { value: name, configurable: true });

export function getAuthUser(supabase, req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  return supabase.auth.getUser(token).then(({ data }) => data.user || null);
}
