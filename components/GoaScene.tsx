/**
 * The stage backdrop: full-screen video background with soft gradient scrims
 * to ensure readability of foreground UI elements.
 */

export default function GoaScene() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[#02150B] overflow-hidden" aria-hidden="true">
      <img
        src="/hero-bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center scale-105"
      />
      {/* Scrim: lifts the top-bar type off the backdrop and sinks the dock into the scene. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/50" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_75%_at_50%_42%,transparent_48%,rgba(2,21,11,0.3)_100%)]" />
    </div>
  );
}
