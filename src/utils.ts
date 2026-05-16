import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | number | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

const femaleUsernames = [
  'karishma.tiwari',
  'madhu.soni',
  'navamita.talukdar',
  'rashmi.mukherjee',
  'sirivennela.gaddam',
  'susmita.chakrabarty',
  'susmita.dastidar',
  'ulfath.naaz'
];

export function getAvatarUrl(username: string, role?: string) {
  const isFemale = femaleUsernames.includes(username);
  
  const skinColors = 'd29985,a47563,c58c70,e1b199,b87352,a55c3c';
  const hairColors = '000000,1c1917,29130c,222222';
  
  let hairStyles = '';
  let facialHairProb = '';
  if (isFemale) {
    hairStyles = 'long,bobCut,pigtails,curly,curlyBun,bobBangs,straightBun,extraLong';
    facialHairProb = '&facialHairProbability=0';
  } else {
    hairStyles = 'shortCombover,buzzcut,bald,balding,fade,shortComboverChops,mohawk,sideShave,curlyHighTop';
    facialHairProb = '&facialHairProbability=15';
  }

  const bgColor = role === 'admin' ? 'eef2ff,c0aede' : 'f1f5f9,e2e8f0';

  let seed = username || 'user';
  if (username === 'arnab.roy') {
    seed = 'arnab.roy_v3';
  } else if (username === 'ulfath.naaz') {
    seed = 'ulfath.naaz_v3';
  } else if (username === 'sirivennela.gaddam') {
    seed = 'sirivennela.gaddam_v2';
  } else if (username === 'navamita.talukdar') {
    seed = 'navamita.talukdar_v4';
  }

  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}&skinColor=${skinColors}&hairColor=${hairColors}&hair=${hairStyles}${facialHairProb}&backgroundColor=${bgColor}`;
}
