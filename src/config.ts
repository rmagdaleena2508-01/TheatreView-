// Feature switches for things that are built but not live yet.

// Showtimes, seat holds and booking (Phase 4). While this is off, the app never
// connects to the database or opens a live-update connection, so visitors only
// load static files from the CDN.
export const BOOKING_ENABLED = false
