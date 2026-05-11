export function useAdminRole(): { isAdmin: boolean } {
  const isAdmin = new URLSearchParams(window.location.search).get('role') === 'admin';
  return { isAdmin };
}
