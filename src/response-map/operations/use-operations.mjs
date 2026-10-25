/** No operations database in the kit: nobody is signed in and nothing is stored on a server. */
const NONE = { data: null, error: '', loading: false, reload: () => {}, retry: () => {} };
export function useOperationsResource() {
  return NONE;
}
