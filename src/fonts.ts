// One font for the whole app: Inter, bundled with the site (no font CDN).
// CSS uses the same stack through the --font variable in index.css.
import '@fontsource-variable/inter'

export const FONT_STACK = "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"

// Text drawn onto canvases (row letters, the placeholder picture) can't swap fonts by
// itself, so callers redraw once the font has finished loading.
export const fontReady: Promise<unknown> =
  typeof document === 'undefined' ? Promise.resolve() : document.fonts.load(`600 44px 'Inter Variable'`)
