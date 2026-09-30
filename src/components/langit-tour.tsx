import { memo, useEffect, useRef, useState, type RefObject } from "react";
import { Compass } from "lucide-react";
import { activeIndex, cameraAt, formatCamera, STOPS, type Camera } from "@/lib/tour";
import "maplibre-gl/dist/maplibre-gl.css";

const SCROLL_VH = 160;

function progressOf(el: HTMLElement | null) {
  if (!el) return 0;
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 0) return 0;
  return el.scrollTop / max;
}

function prefersReduce() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function token(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function viewPadding() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width >= 1024) {
    return { top: 88, right: 48, bottom: 72, left: Math.min(520, Math.round(width * 0.34)) };
  }
  return { top: 76, right: 12, bottom: Math.round(height * 0.46), left: 12 };
}

const MapCanvas = memo(function MapCanvas({
  stageRef,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={stageRef}
      className="map-stage"
      role="region"
      aria-label="Peta satelit tiga dimensi Lombok"
    />
  );
});

export function LangitTour() {
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const applyRef = useRef<() => void>(() => {});
  const exploreRef = useRef(false);
  const [active, setActive] = useState(0);
  const [explore, setExplore] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [coord, setCoord] = useState("Menyambungkan satelit…");

  exploreRef.current = explore;
  const stop = STOPS[active] ?? STOPS[0]!;

  useEffect(() => {
    const stage = stageRef.current;
    const scroller = scrollerRef.current;
    if (!stage || !scroller) return;
    document.documentElement.classList.add("tour-lock");
    let dead = false;
    let styleReady = false;
    let coordAt = 0;

    const apply = () => {
      const map = mapRef.current;
      if (!map || !styleReady || exploreRef.current) return;
      const cam = cameraAt(progressOf(scrollerRef.current), window.innerWidth, prefersReduce());
      map.jumpTo({
        center: cam.center,
        zoom: cam.zoom,
        pitch: cam.pitch,
        bearing: cam.bearing,
        padding: viewPadding(),
      });
      const next = activeIndex(progressOf(scrollerRef.current));
      setActive((prev) => (prev === next ? prev : next));
      const now = performance.now();
      if (now - coordAt > 90) {
        coordAt = now;
        setCoord(formatCamera(cam));
      }
    };
    applyRef.current = apply;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (exploreRef.current) {
          exploreRef.current = false;
          setExplore(false);
        }
        apply();
      });
    };

    const onResize = () => {
      mapRef.current?.resize();
      apply();
    };

    void (async () => {
      const { Map, setWorkerUrl } = await import("maplibre-gl");
      if (dead || !stageRef.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const ink = token("--color-ink", "#0b171c");
      const opening = cameraAt(progressOf(scrollerRef.current), window.innerWidth, prefersReduce());
      let map: import("maplibre-gl").Map;
      try {
        map = new Map({
          container: stageRef.current,
          attributionControl: false,
          fadeDuration: 0,
          maxPitch: 70,
          center: opening.center,
          zoom: opening.zoom,
          pitch: opening.pitch,
          bearing: opening.bearing,
          style: {
            version: 8,
            sources: {
              satellite: {
                type: "raster",
                tiles: [
                  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                ],
                tileSize: 256,
                maxzoom: 18,
              },
              relief: {
                type: "raster-dem",
                tiles: ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"],
                encoding: "terrarium",
                tileSize: 512,
                maxzoom: 12,
              },
              shade: {
                type: "raster-dem",
                tiles: ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"],
                encoding: "terrarium",
                tileSize: 512,
                maxzoom: 12,
              },
            },
            layers: [
              { id: "background", type: "background", paint: { "background-color": ink } },
              { id: "satellite", type: "raster", source: "satellite" },
              {
                id: "hillshade",
                type: "hillshade",
                source: "shade",
                paint: {
                  "hillshade-exaggeration": 0.28,
                  "hillshade-shadow-color": "#071014",
                  "hillshade-highlight-color": "#f3efe6",
                  "hillshade-illumination-direction": 250,
                },
              },
            ],
            terrain: { source: "relief", exaggeration: 1.45 },
            sky: {
              "sky-color": "#7eb6d4",
              "horizon-color": "#d7efe8",
              "fog-color": "#9ec9c4",
              "fog-ground-blend": 0.08,
              "horizon-fog-blend": 0.45,
              "sky-horizon-blend": 0.7,
              "atmosphere-blend": 0.4,
            },
          },
        });
      } catch {
        if (!dead) setFailed(true);
        return;
      }

      mapRef.current = map;
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.dragRotate.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
      map.dragPan.disable();

      map.on("error", () => {
        /* Tile misses stay off the console; the basemap keeps rendering. */
      });
      map.on("style.load", () => {
        styleReady = true;
        apply();
      });
      map.on("load", () => {
        if (dead) return;
        styleReady = true;
        setReady(true);
        apply();
        setCoord(formatCamera(cameraAt(progressOf(scrollerRef.current), window.innerWidth, prefersReduce())));
      });
      map.on("move", () => {
        if (!exploreRef.current || !mapRef.current) return;
        const center = mapRef.current.getCenter();
        const cam: Camera = {
          center: [center.lng, center.lat],
          zoom: mapRef.current.getZoom(),
          pitch: mapRef.current.getPitch(),
          bearing: mapRef.current.getBearing(),
        };
        const now = performance.now();
        if (now - coordAt > 90) {
          coordAt = now;
          setCoord(formatCamera(cam));
        }
      });
    })();

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("tour-lock");
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      mapRef.current?.remove();
      mapRef.current = null;
      styleReady = false;
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const interactive = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("button, a, nav"));

    const onWheel = (event: WheelEvent) => {
      if (exploreRef.current || interactive(event.target)) return;
      event.preventDefault();
      scroller.scrollTop += event.deltaY;
    };

    let lastY = 0;
    let velocity = 0;
    let tracking = false;
    let glideFrame = 0;
    const stopGlide = () => cancelAnimationFrame(glideFrame);
    const glide = () => {
      velocity *= 0.94;
      if (Math.abs(velocity) < 0.35) return;
      scroller.scrollTop += velocity;
      glideFrame = requestAnimationFrame(glide);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (exploreRef.current || event.touches.length !== 1 || interactive(event.target)) {
        tracking = false;
        return;
      }
      stopGlide();
      tracking = true;
      lastY = event.touches[0]?.clientY ?? 0;
      velocity = 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || exploreRef.current || event.touches.length !== 1) return;
      const y = event.touches[0]?.clientY ?? lastY;
      const delta = lastY - y;
      lastY = y;
      velocity = delta;
      scroller.scrollTop += delta;
      event.preventDefault();
    };
    const onTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      stopGlide();
      glide();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      stopGlide();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const stage = stageRef.current;
    if (!map || !stage) return;
    stage.classList.toggle("is-live", explore);
    if (explore) {
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
      return;
    }
    map.dragPan.disable();
    map.touchZoomRotate.disable();
    map.doubleClickZoom.disable();
    applyRef.current();
  }, [explore]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      const dir = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      scrollToStop(scrollerRef.current, Math.min(STOPS.length - 1, Math.max(0, active + dir)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    document.title = `${stop.title} · Dari Langit`;
  }, [stop.title]);

  return (
    <main>
      <div ref={scrollerRef} className="tour-scroll">
        <div aria-hidden style={{ height: `${STOPS.length * SCROLL_VH}vh` }} />
      </div>
      <div className={"pointer-events-none fixed inset-0 " + (explore ? "z-20" : "z-0")}>
        <MapCanvas stageRef={stageRef} />
        <div className="vignette pointer-events-none absolute inset-0" />
      </div>

      <header className="hud-top pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-4 px-4 lg:px-8">
        <div>
          <p className="font-display text-2xl leading-none text-foam">
            Dari <span className="italic text-lagoon">Langit</span>
          </p>
          <p className="mt-1 text-xs tracking-widest text-mist uppercase">Lombok · tiga gili</p>
        </div>
        <button
          type="button"
          aria-pressed={explore}
          onClick={() => setExplore((value) => !value)}
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-panel px-4 text-sm text-foam transition-colors duration-200 hover:border-lagoon"
        >
          <Compass className="size-4 text-lagoon" aria-hidden />
          {explore ? "Kembali" : "Jelajah"}
        </button>
      </header>

      <section className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 lg:px-8 lg:pb-8">
        <article className="story-card pointer-events-none w-full p-5 lg:max-w-xl lg:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs tracking-widest text-lagoon uppercase">{stop.kicker}</p>
            <p className="text-xs tabular-nums text-mist">
              {stop.index} / 04
            </p>
          </div>
          <h1 className="mt-2 font-display text-4xl leading-none text-foam lg:text-5xl">{stop.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-foam">{stop.body}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            {stop.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs text-mist">{fact.label}</dt>
                <dd className="mt-1 text-sm text-foam">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <nav className="pointer-events-auto mt-4 grid grid-cols-4 gap-1" aria-label="Perhentian tur">
            {STOPS.map((item, index) => {
              const current = index === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => scrollToStop(scrollerRef.current, index)}
                  className={
                    "min-h-11 truncate rounded-full px-1 text-xs transition-colors duration-200 " +
                    (current ? "bg-lagoon font-medium text-ink" : "text-mist hover:text-foam")
                  }
                >
                  {item.nav}
                </button>
              );
            })}
          </nav>
          <p className="mt-3 text-xs text-mist">
            {failed
              ? "Peta tiga dimensi tidak bisa dimuat di peramban ini."
              : explore
                ? "Seret peta untuk melihat sekitar. Ketuk Kembali untuk lanjut."
                : active === 0
                  ? ready
                    ? "Gulir untuk menyelam ke tiga Gili."
                    : coord
                  : coord}
          </p>
          <p className="mt-2 text-xs text-mist">Citra satelit © Esri, Maxar · Relief © Mapterhorn</p>
        </article>
      </section>
    </main>
  );
}

function scrollToStop(el: HTMLElement | null, index: number) {
  if (!el) return;
  const max = el.scrollHeight - el.clientHeight;
  const top = (index / (STOPS.length - 1)) * Math.max(max, 0);
  el.scrollTo({ top, behavior: prefersReduce() ? "auto" : "smooth" });
}
