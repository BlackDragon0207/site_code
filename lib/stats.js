const CHANNEL_ID = 'UCm-43e3QtutTBrlD-MuUM1A';
const FALLBACK_STATS = { subscribers: 4110, videos: 943 };
const STATS_TTL_MS = 30 * 60 * 1000;

let statsCache = { data: null, fetchedAt: 0 };

// YouTube Data API v3에서 실시간 통계를 가져온다.
// YOUTUBE_API_KEY가 없거나 호출이 실패하면 null을 반환하고 기본값을 사용한다.
async function fetchChannelStats() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  const base = process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3';
  const url = `${base}/channels?part=statistics&id=${CHANNEL_ID}&key=${encodeURIComponent(apiKey)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const stats = json && json.items && json.items[0] && json.items[0].statistics;
    const subscribers = Number(stats && stats.subscriberCount);
    const videos = Number(stats && stats.videoCount);
    if (!Number.isFinite(subscribers) || !Number.isFinite(videos)) return null;
    return { subscribers, videos };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getChannelStats() {
  const now = Date.now();
  if (statsCache.data && now - statsCache.fetchedAt < STATS_TTL_MS) {
    return { ok: true, cached: true, ...statsCache.data };
  }
  const live = await fetchChannelStats();
  if (live) {
    statsCache = { data: live, fetchedAt: now };
    return { ok: true, cached: false, ...live };
  }
  if (statsCache.data) {
    return { ok: true, cached: true, stale: true, ...statsCache.data };
  }
  return { ok: false, ...FALLBACK_STATS };
}

module.exports = { getChannelStats, FALLBACK_STATS };
