/** Shared class recipes, so the dock and the upload plate stay one object. */

export const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.97] sm:text-xs';

/** The one loud thing on the page. */
export const BTN_PRIMARY = `${BTN_BASE} bg-hh-yellow px-5 py-3 text-hh-ink hover:bg-[#fff36a] disabled:hover:bg-hh-yellow`;

export const BTN_SECONDARY = `${BTN_BASE} border border-hh-cream/35 bg-hh-cream/5 px-5 py-3 text-hh-cream hover:border-hh-cream/70 hover:bg-hh-cream/10`;

export const BTN_QUIET = `${BTN_BASE} px-3 py-2 text-hh-cream/70 hover:text-hh-cream`;

/** Small-caps mono label used above every field and group. */
export const LABEL =
  'block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-hh-cream/55';
