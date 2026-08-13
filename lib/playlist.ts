export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  durationFormatted: string;
  audioUrl: string;
  coverUrl: string;
}

export const PLAYLIST: Track[] = [
  {
    id: 'track-1',
    title: 'Track 1',
    artist: 'Goa Radio',
    duration: 372,
    durationFormatted: '6:12',
    audioUrl: '/audio/saloon-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'track-2',
    title: 'Track 2',
    artist: 'Goa Radio',
    duration: 425,
    durationFormatted: '7:05',
    audioUrl: '/audio/saloon-2.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'track-3',
    title: 'Track 3',
    artist: 'Goa Radio',
    duration: 344,
    durationFormatted: '5:44',
    audioUrl: '/audio/saloon-3.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=80',
  },
];
