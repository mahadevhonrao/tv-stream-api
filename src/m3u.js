// Parses an M3U/M3U8 playlist into an array of channel objects.
export function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let meta = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const attrs = {};
      for (const m of line.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
      const name = line.slice(line.lastIndexOf(",") + 1).trim();
      meta = {
        id: attrs["tvg-id"] || "",
        name: name || attrs["tvg-name"] || "Unnamed channel",
        logo: attrs["tvg-logo"] || "",
        country: attrs["tvg-country"] || "",
        groups: (attrs["group-title"] || "Other")
          .split(";")
          .map((g) => g.trim())
          .filter(Boolean),
      };
    } else if (!line.startsWith("#") && meta) {
      channels.push({ ...meta, url: line, key: `${channels.length}-${meta.name}` });
      meta = null;
    }
  }
  return channels;
}
