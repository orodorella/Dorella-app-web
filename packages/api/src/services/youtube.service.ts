import { getVideoInfo } from 'untube';

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function getYouTubeDuration(url: string): Promise<number | null> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) return null;
    const info = await getVideoInfo(videoId);
    return info.duration || null;
  } catch {
    return null;
  }
}
