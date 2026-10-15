/**
 * HLS playlist rewriting for gated playback (ADR-0005).
 * The bucket is private. The API serves playlists after an access check and rewrites
 * every URI inside them via `resolve` — child playlists point back at the API,
 * media segments become short-lived presigned URLs.
 */

const URI_ATTR = /URI="([^"]+)"/g;

export function rewritePlaylist(playlist: string, resolve: (uri: string) => string): string {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return line;
      if (trimmed.startsWith("#")) {
        // Tags like #EXT-X-MAP / #EXT-X-KEY / #EXT-X-MEDIA carry URIs in attributes.
        return line.replace(URI_ATTR, (_m, uri: string) => `URI="${resolve(uri)}"`);
      }
      return resolve(trimmed);
    })
    .join("\n");
}

/**
 * Resolve a URI from inside a playlist against the playlist's own path, refusing
 * anything that escapes the video's HLS prefix (path traversal / absolute URLs).
 */
export function resolveHlsPath(playlistPath: string, uri: string): string {
  if (/^[a-z]+:\/\//i.test(uri) || uri.startsWith("/"))
    throw new Error(`Absolute URI not allowed in playlist: ${uri}`);
  const base = playlistPath.split("/").slice(0, -1);
  for (const part of uri.split("/")) {
    if (part === "..") {
      if (base.length === 0) throw new Error(`Path escapes HLS root: ${uri}`);
      base.pop();
    } else if (part !== "." && part !== "") {
      base.push(part);
    }
  }
  return base.join("/");
}

export function isPlaylist(path: string): boolean {
  return path.endsWith(".m3u8");
}
