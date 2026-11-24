const paths: Record<string, string[]> = {
  message: ['M4 4h16v12H9l-5 4V4Z', 'M8 8h8', 'M8 12h5'],
  bell: ['M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3V9Z', 'M10 21h4'],
  settings: ['M4 6h16', 'M4 12h16', 'M4 18h16', 'M8 4v4', 'M16 10v4', 'M9 16v4'],
  shield: ['M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7l-9-4Z', 'm8 12 3 3 5-6'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1'],
  moon: ['M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M3 12h18', 'M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z'],
  plus: ['M12 5v14', 'M5 12h14'],
  bookmark: ['M6 3h12v18l-6-4-6 4V3Z'],
  logout: ['M10 4H4v16h6', 'M9 12h12', 'm16 7 5 5-5 5'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9 21v-6h6v6'],
  route: ['M4 18c3-7 5-9 8-8s4 5 8-2', 'M4 18h4', 'M16 8h4'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M20 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  listing: ['M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z', 'M3 12l9 4.5 9-4.5', 'M3 16.5 12 21l9-4.5'],
  map: ['M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3V6Z', 'M9 3v15', 'M15 6v15'],
  bike: ['M5 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'M19 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'm5 19 4-9h5l5 9', 'M8 10h4l3 4', 'M6 6h4'],
}

export default function Icon({ name, size = 19 }: { name: string; size?: number }) {
  if (name === 'bike') return <svg width={size} height={size} viewBox="0 0 64 44" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="13" cy="31" r="10"/><circle cx="51" cy="31" r="10"/><path d="m13 31 13-15h13l12 15M25 17l-5-7H9m22 7-5 14H13m13 0h12l-8-12m12-2-5-12h-7M22 12h12l6 5H27m0 14h11M4 19h13M44 19h7"/></svg>
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(paths[name] ?? paths.home).map((d, index) => <path key={index} d={d}/>)}</svg>
}
