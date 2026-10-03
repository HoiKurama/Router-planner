const paths = {
  spark: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  copy: 'M9 9h11v11H9zM15 5V3H3v12h2',
  edit: 'm15 4 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16l-1 4Z',
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 1.4 1.4m10 10 1.4 1.4M5.6 18.4 1.4-1.4m10-10 1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z',
  reset: 'M4 9a8 8 0 1 1 0 6M4 3v6h6',
  check: 'm5 12 4 4L19 6',
  chevron: 'm9 5 7 7-7 7',
  info: 'M12 11v6m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  scan: 'M4 8V4h4m8 0h4v4M4 16v4h4m8 0h4v-4M7 9h10M7 13h10M7 17h5',
} as const

export function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
