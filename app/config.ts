const env = import.meta.env as unknown as {
  VITE_TELEMETRY_ENABLED?: string
  VITE_TELEMETRY_ENDPOINT?: string
  VITE_APP_VERSION?: string
}

export default {
  backdropBaseUrl: '',
  posterBaseUrl: '',
  sourceCodeUrl: 'https://github.com/josh-wt/nothing-to-watch-but-anime',
  anilistUrl: 'https://anilist.co',
  anilistAnimeBaseUrl: 'https://anilist.co/anime/',
  contactEmail: '96j0o1ivb@mozmail.com',
  disableUI: false,
  telemetry: {
    enabled:
      env?.VITE_TELEMETRY_ENABLED === '1' ||
      env?.VITE_TELEMETRY_ENABLED === 'true',
    endpoint: env?.VITE_TELEMETRY_ENDPOINT || undefined,
    appVersion: env?.VITE_APP_VERSION || undefined,
  },
}
