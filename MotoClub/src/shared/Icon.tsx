const paths: Record<string, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9 21v-6h6v6'],
  route: ['M4 18c3-7 5-9 8-8s4 5 8-2', 'M4 18h4', 'M16 8h4'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M20 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  listing: ['M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z', 'M3 12l9 4.5 9-4.5', 'M3 16.5 12 21l9-4.5'],
  map: ['M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3V6Z', 'M9 3v15', 'M15 6v15'],
  bike: ['M5 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'M19 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'm5 19 4-9h5l5 9', 'M8 10h4l3 4', 'M6 6h4'],
}

export default function Icon({ name, size = 19 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(paths[name] ?? paths.home).map((d, index) => <path key={index} d={d}/>)}</svg>
}
