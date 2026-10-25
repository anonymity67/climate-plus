/** The collaborator kit has no server: routes are always calculated in the browser from the
 *  frozen road snapshots. Same shape as the V3 hook so the map code is unchanged. */
const NONE = { data: null, error: '', loading: false, retry: () => {} };
export function useServerPlan() {
  return NONE;
}
