import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export default function Player({ channel, onPrev, onNext }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading | playing | error

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return;

    setStatus("loading");
    let hls;

    const tryPlay = () => {
      video.play().catch(() => {
        // Browsers may block sound autoplay; retry muted.
        video.muted = true;
        video.play().catch(() => {});
      });
    };

    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setStatus("error");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / iOS play HLS natively
      video.src = channel.url;
      video.addEventListener("loadedmetadata", tryPlay, { once: true });
    } else {
      setStatus("error");
    }

    const onPlaying = () => setStatus("playing");
    const onWaiting = () => setStatus("loading");
    const onError = () => setStatus("error");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onError);
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel]);

  return (
    <section className="player">
      <div className="screen">
        <video ref={videoRef} controls playsInline />
        {!channel && (
          <div className="overlay">
            <p>Pick a channel from the list to start watching.</p>
          </div>
        )}
        {channel && status === "loading" && (
          <div className="overlay">
            <span className="spinner" aria-hidden="true" />
            <p>Connecting to {channel.name}…</p>
          </div>
        )}
        {channel && status === "error" && (
          <div className="overlay">
            <p>This stream isn’t available right now.</p>
            <button className="btn" onClick={onNext}>Try the next channel</button>
          </div>
        )}
      </div>

      <div className="now">
        <div className="now-info">
          {channel ? (
            <>
              <h2>
                <span className={`dot ${status}`} aria-hidden="true" />
                {channel.name}
              </h2>
              <p>{channel.languages.join(", ")} • {channel.groups.join(", ")}</p>
            </>
          ) : (
            <h2>No channel selected</h2>
          )}
        </div>
        <div className="now-actions">
          <button className="btn" onClick={onPrev} disabled={!channel}>Previous</button>
          <button className="btn" onClick={onNext} disabled={!channel}>Next</button>
        </div>
      </div>
    </section>
  );
}
