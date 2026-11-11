import { useEffect, useMemo, useRef, useState } from "react";
import { parseM3U } from "./m3u.js";
import Player from "./Player.jsx";

const PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";
const LANGUAGE_URL = "https://iptv-org.github.io/iptv/index.language.m3u";
const PAGE_SIZE = 80;

function loadFavs() {
  try {
    return new Set(JSON.parse(localStorage.getItem("iptv-favs") || "[]"));
  } catch {
    return new Set();
  }
}

export default function App() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [language, setLanguage] = useState("All");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [favs, setFavs] = useState(loadFavs);
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinel = useRef(null);

  // Fetch + parse the playlist
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const [mainRes, langRes] = await Promise.all([
          fetch(PLAYLIST_URL, { signal: ctrl.signal }),
          // The language playlist is optional: if it fails, channels just have no language.
          fetch(LANGUAGE_URL, { signal: ctrl.signal }).catch(() => null),
        ]);
        if (!mainRes.ok) throw new Error(`Playlist request failed (${mainRes.status})`);
        const list = parseM3U(await mainRes.text());

        // In index.language.m3u the group-title is the language, so map stream URL -> languages
        const langByUrl = new Map();
        if (langRes && langRes.ok) {
          for (const c of parseM3U(await langRes.text())) {
            const set = langByUrl.get(c.url) || new Set();
            c.groups.forEach((g) => set.add(g));
            langByUrl.set(c.url, set);
          }
        }
        setChannels(
          list.map((c) => ({ ...c, languages: [...(langByUrl.get(c.url) || ["Undefined"])] }))
        );
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "Could not load the playlist.");
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Category list with counts
  const groups = useMemo(() => {
    const counts = new Map();
    channels.forEach((c) => c.groups.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [channels]);

  // Language list with counts
  const languages = useMemo(() => {
    const counts = new Map();
    channels.forEach((c) => c.languages.forEach((l) => counts.set(l, (counts.get(l) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [channels]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter(
      (c) =>
        (group === "All" || c.groups.includes(group)) &&
        (language === "All" || c.languages.includes(language)) &&
        (!onlyFavs || favs.has(c.url)) &&
        (!q || c.name.toLowerCase().includes(q))
    );
  }, [channels, query, group, language, onlyFavs, favs]);

  // Reset paging when filters change
  useEffect(() => setVisible(PAGE_SIZE), [query, group, language, onlyFavs]);

  // Infinite scroll: render more rows as the user nears the bottom
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible((v) => v + PAGE_SIZE),
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const toggleFav = (url) => {
    setFavs((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      try {
        localStorage.setItem("iptv-favs", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const step = (dir) => {
    if (!filtered.length) return;
    const i = filtered.findIndex((c) => c.key === current?.key);
    const next = filtered[(i + dir + filtered.length) % filtered.length];
    setCurrent(next);
  };

  return (
    <div className="app">
      <header className="top">
        <h1>IPTV Player</h1>
        <span className="count">
          {loading ? "Loading…" : `${filtered.length.toLocaleString()} of ${channels.length.toLocaleString()} channels`}
        </span>
      </header>

      <main className="layout">
        <Player channel={current} onPrev={() => step(-1)} onNext={() => step(1)} />

        <aside className="list-panel">
          <div className="filters">
            <input
              type="search"
              placeholder="Search channels"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search channels"
            />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
              <option value="All">All languages</option>
              {languages.map(([l, n]) => (
                <option key={l} value={l}>{l} ({n})</option>
              ))}
            </select>
            <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Category">
              <option value="All">All categories</option>
              {groups.map(([g, n]) => (
                <option key={g} value={g}>{g} ({n})</option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={onlyFavs} onChange={(e) => setOnlyFavs(e.target.checked)} />
              Favorites only
            </label>
          </div>

          {error && <p className="msg error">{error} Check your connection and reload the page.</p>}
          {loading && <p className="msg">Loading the channel list…</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="msg">No channels match. Try a different search or category.</p>
          )}

          <ul className="channels">
            {filtered.slice(0, visible).map((c) => (
              <li key={c.key} className={current?.key === c.key ? "active" : ""}>
                <button className="row" onClick={() => setCurrent(c)}>
                  <span className="logo">
                    {c.logo && (
                      <img
                        src={c.logo}
                        alt=""
                        loading="lazy"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                  </span>
                  <span className="meta">
                    <span className="name">{c.name}</span>
                    <span className="grp">{c.languages.join(", ")} • {c.groups.join(", ")}</span>
                  </span>
                </button>
                <button
                  className={`fav ${favs.has(c.url) ? "on" : ""}`}
                  onClick={() => toggleFav(c.url)}
                  aria-pressed={favs.has(c.url)}
                  aria-label={favs.has(c.url) ? `Remove ${c.name} from favorites` : `Add ${c.name} to favorites`}
                >
                  {favs.has(c.url) ? "★" : "☆"}
                </button>
              </li>
            ))}
          </ul>
          <div ref={sentinel} style={{ height: 1 }} />
        </aside>
      </main>
    </div>
  );
}
