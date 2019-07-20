export function wsUrl(): string {
  let url: string;
  const development = process.env.NODE_ENV === 'development';  // eslint-disable-line
  const secure = window.location.protocol === 'https:';
  const proto = secure ? 'wss://' : 'ws://';
  if (development) {
    // In development websockets are served on a different port
    url = proto + window.location.hostname + ':8000';
  } else {
    url = proto + window.location.host;
  }
  url += '/feed';

  return url;
}
