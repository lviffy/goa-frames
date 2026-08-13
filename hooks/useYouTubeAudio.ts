'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoodType, PLAYLIST, Track } from '@/lib/playlist';

export interface YouTubeAudioState {
  currentTrack: Track;
  currentTrackIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'none' | 'all' | 'one';
  selectedMood: MoodType;
  playlist: Track[];
  isPlayerReady: boolean;
  hasStarted: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  selectTrack: (track: Track) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setSelectedMood: (mood: MoodType) => void;
}

export function useYouTubeAudio(): YouTubeAudioState {
  const [selectedMood, setSelectedMood] = useState<MoodType>('All');
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(PLAYLIST[0].duration);
  const [volume, setVolumeState] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('all');
  const [isPlayerReady, setIsPlayerReady] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filtered playlist based on active mood
  const playlist = useMemo(() => {
    if (selectedMood === 'All') return PLAYLIST;
    return PLAYLIST.filter((t) => t.mood === selectedMood);
  }, [selectedMood]);

  const currentTrack = playlist[currentTrackIndex] || playlist[0] || PLAYLIST[0];

  // Initialize HTML5 Audio instance
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = currentTrack.audioUrl;
    audio.volume = volume / 100;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      setHasStarted(true);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onWaiting = () => {
      setIsBuffering(true);
    };

    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };

    const onEnded = () => {
      handleTrackEnd();
    };

    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // Update audio source when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(0);
    setDuration(currentTrack.duration);

    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => {
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrack]);

  // Update Media Session API for mobile lockscreen & hardware keys
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || 'Saloon Classics',
      artwork: [
        {
          src: currentTrack.coverUrl,
          sizes: '512x512',
          type: 'image/jpeg',
        },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        seekTo(details.seekTime);
      }
    });
  }, [currentTrack]);

  const play = useCallback(() => {
    setHasStarted(true);
    const audio = audioRef.current;
    if (audio) {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Playback prevented by browser autoplay policy', e);
      });
    }
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = seconds;
    }
  }, []);

  const nextTrack = useCallback(() => {
    let nextIndex = currentTrackIndex + 1;
    if (isShuffle && playlist.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * playlist.length);
      } while (nextIndex === currentTrackIndex);
    } else if (nextIndex >= playlist.length) {
      if (repeatMode === 'none') {
        pause();
        return;
      }
      nextIndex = 0;
    }
    setCurrentTrackIndex(nextIndex);
  }, [currentTrackIndex, isShuffle, playlist, repeatMode, pause]);

  const prevTrack = useCallback(() => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
      prevIndex = playlist.length - 1;
    }
    setCurrentTrackIndex(prevIndex);
  }, [currentTime, currentTrackIndex, playlist, seekTo]);

  const selectTrack = useCallback(
    (track: Track) => {
      const idx = playlist.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        setCurrentTrackIndex(idx);
      }
    },
    [playlist],
  );

  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'one') {
      seekTo(0);
      play();
    } else {
      nextTrack();
    }
  }, [repeatMode, seekTo, play, nextTrack]);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVolumeState(clamped);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = clamped / 100;
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
        audio.muted = false;
      }
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (isMuted) {
      setIsMuted(false);
      if (audio) {
        audio.muted = false;
        audio.volume = (volume || 80) / 100;
      }
    } else {
      setIsMuted(true);
      if (audio) {
        audio.muted = true;
      }
    }
  }, [isMuted, volume]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((s) => !s);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'all') return 'one';
      if (prev === 'one') return 'none';
      return 'all';
    });
  }, []);

  const handleMoodChange = useCallback(
    (newMood: MoodType) => {
      setSelectedMood(newMood);
      setCurrentTrackIndex(0);
    },
    [],
  );

  return {
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
    isPlayerReady,
    hasStarted,
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
    setSelectedMood: handleMoodChange,
  };
}
