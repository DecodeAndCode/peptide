/** Dispatched on `/dashboard` to open the tour from the top bar without clearing completion state. */
export const DASHBOARD_TOUR_RESTART_EVENT = "suppgo-dashboard-tour-restart";

/** Set before navigating to `/dashboard` so the tour opens after the route change. */
export const DASHBOARD_TOUR_PENDING_KEY = "suppgo_dashboard_tour_pending";
