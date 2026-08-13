export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  durationFormatted: string;
  audioUrl: string;
  coverUrl: string;
  mood: 'Saloon Classics' | '90s Retro' | 'Goa Sunset' | 'Late Night';
}

export const MOODS = [
  'All',
  'Saloon Classics',
  '90s Retro',
  'Goa Sunset',
  'Late Night',
] as const;

export type MoodType = (typeof MOODS)[number];

export const PLAYLIST: Track[] = [
  {
    id: 'track-1',
    title: 'Mujhse Mohabbat Ka Izhaar Karta',
    artist: 'Setrang Music Official',
    album: 'Saloon Classics',
    duration: 372,
    durationFormatted: '6:12',
    audioUrl: '/audio/saloon-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&auto=format&fit=crop&q=80',
    mood: 'Saloon Classics',
  },
  {
    id: 'track-2',
    title: 'Chura Ke Dil Mera (90s Tape Edition)',
    artist: 'Kumar Sanu & Alka Yagnik',
    album: 'Main Khiladi Tu Anari',
    duration: 425,
    durationFormatted: '7:05',
    audioUrl: '/audio/saloon-2.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    mood: '90s Retro',
  },
  {
    id: 'track-3',
    title: 'Goa Sunset Chill & Ocean Waves',
    artist: 'Anjuna Sunset Lounge',
    album: 'Goa Ambient Sessions',
    duration: 344,
    durationFormatted: '5:44',
    audioUrl: '/audio/saloon-3.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=80',
    mood: 'Goa Sunset',
  },
  {
    id: 'track-4',
    title: 'Pehla Nasha (Barbershop Nostalgia)',
    artist: 'Udit Narayan & Sadhana Sargam',
    album: 'Jo Jeeta Wohi Sikandar',
    duration: 372,
    durationFormatted: '6:12',
    audioUrl: '/audio/saloon-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
    mood: '90s Retro',
  },
  {
    id: 'track-5',
    title: 'Tip Tip Barsa Paani (Retro Mix)',
    artist: 'Udit Narayan & Alka Yagnik',
    album: 'Mohra (1994)',
    duration: 425,
    durationFormatted: '7:05',
    audioUrl: '/audio/saloon-2.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80',
    mood: 'Saloon Classics',
  },
  {
    id: 'track-6',
    title: 'Dil Se Re (Midnight Echoes)',
    artist: 'A. R. Rahman & Anuradha Sriram',
    album: 'Dil Se (1998)',
    duration: 344,
    durationFormatted: '5:44',
    audioUrl: '/audio/saloon-3.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
    mood: 'Late Night',
  },
  {
    id: 'track-7',
    title: 'Aankhon Mein Teri Ajab Si',
    artist: 'KK & Vishal-Shekhar',
    album: 'Om Shanti Om',
    duration: 372,
    durationFormatted: '6:12',
    audioUrl: '/audio/saloon-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    mood: 'Late Night',
  },
  {
    id: 'track-8',
    title: 'Tum Se Hi (Acoustic Night)',
    artist: 'Mohit Chauhan & Pritam',
    album: 'Jab We Met',
    duration: 425,
    durationFormatted: '7:05',
    audioUrl: '/audio/saloon-2.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&auto=format&fit=crop&q=80',
    mood: 'Late Night',
  },
  {
    id: 'track-9',
    title: 'Masakali (Delhi-6 Radio)',
    artist: 'Mohit Chauhan & A.R. Rahman',
    album: 'Delhi-6',
    duration: 344,
    durationFormatted: '5:44',
    audioUrl: '/audio/saloon-3.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300&auto=format&fit=crop&q=80',
    mood: 'Saloon Classics',
  },
  {
    id: 'track-10',
    title: 'Pal (Hum Rahe Ya Na Rahe Kal)',
    artist: 'KK & Leslie Lewis',
    album: 'Pal (1999)',
    duration: 372,
    durationFormatted: '6:12',
    audioUrl: '/audio/saloon-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&auto=format&fit=crop&q=80',
    mood: '90s Retro',
  },
];
