export type Sport = {
  id: string;
  emoji: string;
  label: string;
  query: string;
  freeHint: boolean;
};

export const SPORTS: Sport[] = [
  { id: 'basketball', emoji: '🏀', label: 'Basketball',  query: 'basketball court',   freeHint: true  },
  { id: 'tennis',     emoji: '🎾', label: 'Tennis',      query: 'tennis court',       freeHint: true  },
  { id: 'soccer',     emoji: '⚽', label: 'Soccer',      query: 'soccer field',       freeHint: true  },
  { id: 'swimming',   emoji: '🏊', label: 'Swimming',    query: 'swimming pool',      freeHint: false },
  { id: 'golf',       emoji: '⛳', label: 'Golf',        query: 'golf course',        freeHint: false },
  { id: 'bowling',    emoji: '🎳', label: 'Bowling',     query: 'bowling alley',      freeHint: false },
  { id: 'climbing',   emoji: '🧗', label: 'Climbing',    query: 'rock climbing gym',  freeHint: false },
  { id: 'boxing',     emoji: '🥊', label: 'Boxing',      query: 'boxing gym',         freeHint: false },
  { id: 'volleyball', emoji: '🏐', label: 'Volleyball',  query: 'volleyball court',   freeHint: true  },
  { id: 'hockey',     emoji: '🏒', label: 'Hockey',      query: 'ice rink',           freeHint: false },
  { id: 'badminton',  emoji: '🏸', label: 'Badminton',   query: 'badminton court',    freeHint: true  },
  { id: 'cycling',    emoji: '🚴', label: 'Cycling',     query: 'bike trail',         freeHint: true  },
  { id: 'other',      emoji: '✨', label: 'Other sport', query: '',                   freeHint: false },
];
