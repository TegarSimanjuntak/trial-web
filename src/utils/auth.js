export function getAuthHeader(session) {
  if (!session) return {};
  return { Authorization: `Bearer ${session.access_token ?? (session?.user?.access_token || '')}` };

}
