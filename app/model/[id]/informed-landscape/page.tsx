/**
 * `/model/[id]/informed-landscape` — passthrough route.
 *
 * Renders the same workspace component as `/model/[id]`. The workspace
 * reads `usePathname()` and swaps `HypothesisVariantsBar` for
 * `InformedVariantsBar` when this route is active. This avoids
 * duplicating the entire canvas implementation while still giving
 * Informed Landscape its own URL (so deep-links, the AppHeader step
 * router, and browser history all behave correctly).
 */
import WorkspacePage from '../page';

export default WorkspacePage;
