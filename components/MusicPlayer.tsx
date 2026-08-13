'use client';

import { useEffect, useRef, useState } from 'react';
import { MOODS, MoodType, Track } from '@/lib/playlist';
import { useYouTubeAudio } from '@/hooks/useYouTubeAudio';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MusicPlayer({ hasDock }: { hasDock?: boolean }) {
  const {
    currentTrack,
    currentTrackIndex,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    selectedMood,
    playlist,
    play,
    pause,
    togglePlay,
    seekTo,
    nextTrack,
    prevTrack,
    selectTrack,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    setSelectedMood,
  } = useYouTubeAudio();

  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const playlistRef = useRef<HTMLDivElement>(null);

  // Close playlist on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        playlistRef.current &&
        !playlistRef.current.contains(event.target as Node)
      ) {
        setIsPlaylistOpen(false);
      }
    }
    if (isPlaylistOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPlaylistOpen]);

  // Keyboard shortcut listener (Space to play/pause, M to mute)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute]);

  // Hide music player UI completely while making/editing the ticket
  if (hasDock) {
    return null;
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Minimized state: sleek floating vinyl badge
  if (isMinimized) {
    return (
      <aside
        aria-label="Audio player mini widget"
        className="fixed bottom-6 right-6 z-40 transition-all duration-300"
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="group relative flex size-12 items-center justify-center rounded-full border border-hh-cream/25 bg-black/80 p-1.5 shadow-[0_8px_25px_rgba(0,0,0,0.6)] backdrop-blur-xl transition hover:scale-105 hover:border-hh-yellow active:scale-95"
          title={`Now playing: ${currentTrack.title} — Click to expand player`}
          aria-label="Expand music player"
        >
          {/* Vinyl Disc */}
          <div
            className={`relative size-full overflow-hidden rounded-full border border-black/80 shadow-inner ${
              isPlaying ? 'animate-spin-slow' : 'animation-paused'
            }`}
            style={{
              background: 'radial-gradient(circle, #222 20%, #111 60%, #050505 100%)',
            }}
          >
            <img
              src={currentTrack.coverUrl}
              alt=""
              className="size-full rounded-full object-cover opacity-80"
            />
            <div className="absolute inset-0 m-auto size-2 rounded-full border border-white/40 bg-black" />
          </div>

          {/* Sound waves indicator */}
          {isPlaying && (
            <div className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-hh-yellow text-[9px] font-bold text-black shadow-md">
              <span className="size-1.5 animate-ping rounded-full bg-black" />
            </div>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Saloon Music Player"
      className="fixed bottom-4 sm:bottom-6 left-1/2 z-40 w-[94vw] max-w-[560px] -translate-x-1/2 transition-all duration-300 ease-out"
    >
      {/* Playlist Drawer Modal */}
      {isPlaylistOpen && (
        <div
          ref={playlistRef}
          className="animate-in fade-in slide-in-from-bottom-3 absolute bottom-full mb-3 w-full rounded-2xl border border-hh-cream/20 bg-[#07120ce8] p-4 text-hh-cream shadow-[0_16px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl duration-200"
        >
          <div className="flex items-center justify-between border-b border-hh-cream/15 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-hh-yellow">
                📻 Saloon Radio Playlist
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-hh-cream/70">
                {playlist.length} tracks
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPlaylistOpen(false)}
              className="rounded-full p-1 text-hh-cream/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close playlist"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Mood Filter Tabs */}
          <div className="no-scrollbar mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
            {MOODS.map((mood) => (
              <button
                key={mood}
                type="button"
                onClick={() => setSelectedMood(mood)}
                className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] transition ${
                  selectedMood === mood
                    ? 'bg-hh-yellow font-bold text-black shadow-sm'
                    : 'bg-white/10 text-hh-cream/70 hover:bg-white/15 hover:text-white'
                }`}
              >
                {mood}
              </button>
            ))}
          </div>

          {/* Track List */}
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
            {playlist.map((track, idx) => {
              const isCurrent = currentTrack.id === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => {
                    selectTrack(track);
                    setIsPlaylistOpen(false);
                  }}
                  className={`group flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                    isCurrent
                      ? 'bg-white/15 text-white ring-1 ring-hh-yellow/40'
                      : 'hover:bg-white/10 text-hh-cream/80'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {/* Index or Live Equalizer */}
                    <div className="flex size-6 shrink-0 items-center justify-center font-mono text-xs">
                      {isCurrent && isPlaying ? (
                        <div className="flex items-end gap-0.5">
                          <span className="animate-soundbar-1 inline-block w-0.5 rounded-full bg-hh-yellow" />
                          <span className="animate-soundbar-2 inline-block w-0.5 rounded-full bg-hh-yellow" />
                          <span className="animate-soundbar-3 inline-block w-0.5 rounded-full bg-hh-yellow" />
                        </div>
                      ) : (
                        <span className="text-[11px] text-hh-cream/40 group-hover:text-hh-cream">
                          {idx + 1}
                        </span>
                      )}
                    </div>

                    <img
                      src={track.coverUrl}
                      alt=""
                      className="size-8 rounded-lg object-cover shadow-sm"
                    />

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-mono text-xs ${
                          isCurrent ? 'font-bold text-hh-yellow' : 'font-medium text-hh-cream'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="truncate font-mono text-[10px] text-hh-cream/60">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-hh-cream/50">
                    {track.durationFormatted}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Glassmorphic Music Player Bar */}
      <div className="group/player relative flex items-center justify-between gap-2.5 rounded-full border border-hh-cream/20 bg-[#050f09]/85 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl backdrop-saturate-150 transition-all hover:border-hh-cream/35 sm:gap-3.5 sm:px-4 sm:py-2.5">
        
        {/* Left Section: Spinning Vinyl Record */}
        <button
          type="button"
          onClick={togglePlay}
          className="group relative size-10 shrink-0 overflow-hidden rounded-full border border-hh-cream/30 bg-black/60 p-0.5 shadow-md transition hover:scale-105 active:scale-95 sm:size-11"
          aria-label={isPlaying ? 'Pause music' : 'Play music'}
        >
          {/* Vinyl Disc Grooves */}
          <div
            className={`relative size-full overflow-hidden rounded-full border border-neutral-900 shadow-inner ${
              isPlaying ? 'animate-spin-slow' : 'animation-paused'
            }`}
            style={{
              background:
                'radial-gradient(circle, #2a2a2a 15%, #181818 45%, #0d0d0d 80%, #000 100%)',
            }}
          >
            <img
              src={currentTrack.coverUrl}
              alt=""
              className="size-full rounded-full object-cover opacity-85"
            />
            {/* Center vinyl spindle hole */}
            <div className="absolute inset-0 m-auto size-2 rounded-full border border-white/50 bg-black/90 shadow-sm" />
          </div>

          {/* Hover Play/Pause Overlay */}
          <span className="absolute inset-0 hidden place-items-center rounded-full bg-black/50 group-hover:grid">
            {isPlaying ? (
              <svg viewBox="0 0 24 24" className="size-4 text-white" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4 text-white" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </span>
        </button>

        {/* Middle Section: Track Details & Scrubbable Seek Bar */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate font-mono text-[11px] font-semibold text-hh-cream sm:text-xs">
                {currentTrack.title}
              </p>
              {isPlaying && (
                <span className="hidden items-end gap-0.5 sm:flex" aria-hidden="true">
                  <span className="animate-soundbar-1 inline-block h-3 w-0.5 rounded-full bg-hh-yellow" />
                  <span className="animate-soundbar-2 inline-block h-2 w-0.5 rounded-full bg-hh-yellow" />
                  <span className="animate-soundbar-3 inline-block h-3.5 w-0.5 rounded-full bg-hh-yellow" />
                  <span className="animate-soundbar-4 inline-block h-1.5 w-0.5 rounded-full bg-hh-yellow" />
                </span>
              )}
            </div>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-hh-cream/60 sm:text-[11px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <p className="truncate font-mono text-[10px] text-hh-cream/55 sm:text-[11px]">
            {currentTrack.artist}
          </p>

          {/* Seek Progress Bar */}
          <div className="relative mt-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={1}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              aria-label="Track progress slider"
              className="audio-slider h-1 w-full"
              style={{
                background: `linear-gradient(to right, #fee101 ${progressPercent}%, rgba(255, 251, 232, 0.2) ${progressPercent}%)`,
              }}
            />
          </div>
        </div>

        {/* Right Section: Playback Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Previous Track */}
          <button
            type="button"
            onClick={prevTrack}
            className="rounded-full p-1.5 text-hh-cream/70 transition hover:bg-white/10 hover:text-white active:scale-95 sm:p-2"
            title="Previous track"
            aria-label="Previous track"
          >
            <svg viewBox="0 0 24 24" className="size-4 sm:size-4.5" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Big Play / Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="group flex size-8 shrink-0 items-center justify-center rounded-full bg-hh-cream text-[#032a16] shadow-md transition hover:scale-105 hover:bg-hh-yellow active:scale-90 sm:size-9"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-0.5 size-4.5" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={nextTrack}
            className="rounded-full p-1.5 text-hh-cream/70 transition hover:bg-white/10 hover:text-white active:scale-95 sm:p-2"
            title="Next track"
            aria-label="Next track"
          >
            <svg viewBox="0 0 24 24" className="size-4 sm:size-4.5" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          {/* Volume Control with Popover / Hover */}
          <div
            className="relative hidden sm:block"
            onMouseEnter={() => setIsVolumeHovered(true)}
            onMouseLeave={() => setIsVolumeHovered(false)}
          >
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-full p-1.5 text-hh-cream/70 transition hover:bg-white/10 hover:text-white"
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.66 4.66L7 9v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : volume < 50 ? (
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {isVolumeHovered && (
              <div className="absolute bottom-full left-1/2 -mb-1 flex -translate-x-1/2 flex-col items-center rounded-xl border border-hh-cream/15 bg-[#050f09]/95 p-2 shadow-xl backdrop-blur-xl">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume slider"
                  className="audio-slider h-20 w-1 [writing-mode:vertical-lr] [direction:rtl]"
                />
                <span className="mt-1 font-mono text-[9px] tabular-nums text-hh-cream/60">
                  {isMuted ? 0 : volume}%
                </span>
              </div>
            )}
          </div>

          {/* Open Playlist Drawer Button */}
          <button
            type="button"
            onClick={() => setIsPlaylistOpen((prev) => !prev)}
            className={`rounded-full p-1.5 transition active:scale-95 ${
              isPlaylistOpen
                ? 'bg-hh-yellow text-black'
                : 'text-hh-cream/70 hover:bg-white/10 hover:text-white'
            }`}
            title="Playlist queue"
            aria-label="Playlist queue"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h10M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Minimize Player Button */}
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="rounded-full p-1 text-hh-cream/40 transition hover:bg-white/10 hover:text-hh-cream"
            title="Minimize to floating badge"
            aria-label="Minimize player"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
