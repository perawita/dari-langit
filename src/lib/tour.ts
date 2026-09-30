export type LngLat = [number, number];

export type Stop = {
  id: string;
  index: string;
  nav: string;
  kicker: string;
  title: string;
  body: string;
  facts: { label: string; value: string }[];
  center: LngLat;
  /** Zoom tuned for a 900px-wide viewport. Wider screens zoom in so the island stays framed. */
  zoom: number;
  pitch: number;
  bearing: number;
};

export const STOPS: Stop[] = [
  {
    id: "lombok",
    index: "01",
    nav: "Lombok",
    kicker: "Nusa Tenggara Barat",
    title: "Pulau Lombok",
    body: "Pulau di sebelah timur Bali. Rinjani mengawasi utara, pantai selatan membuka ke Samudra Hindia, dan di barat laut tiga pulau kecil duduk di atas cincin terumbu.",
    facts: [
      { label: "Puncak", value: "Rinjani 3.726 m" },
      { label: "Kota", value: "Mataram" },
      { label: "Utara", value: "Tiga Gili" },
    ],
    center: [116.32, -8.6],
    zoom: 10.05,
    pitch: 50,
    bearing: -32,
  },
  {
    id: "trawangan",
    index: "02",
    nav: "Trawangan",
    kicker: "Kepulauan Gili · barat",
    title: "Gili Trawangan",
    body: "Yang terbesar, dan yang paling ramai setelah senja. Jalannya hanya untuk sepeda, cidomo, dan kaki. Di siang hari air di tepi barat berubah dari pirus ke biru dalam.",
    facts: [
      { label: "Ukuran", value: "Terbesar" },
      { label: "Jalan", value: "Tanpa motor" },
      { label: "Satwa", value: "Penyu" },
    ],
    center: [116.0376, -8.3504],
    zoom: 15.35,
    pitch: 62,
    bearing: 38,
  },
  {
    id: "meno",
    index: "03",
    nav: "Meno",
    kicker: "Kepulauan Gili · tengah",
    title: "Gili Meno",
    body: "Pulau tengah yang paling pelan. Danau asin terbaring di tengah hutan rendah, bungalow jarang, dan perahu kayu menyeberang tanpa terburu-buru.",
    facts: [
      { label: "Suasana", value: "Paling sunyi" },
      { label: "Tengah", value: "Danau asin" },
      { label: "Irama", value: "Perahu kayu" },
    ],
    center: [116.0576, -8.3516],
    zoom: 15.55,
    pitch: 60,
    bearing: -24,
  },
  {
    id: "air",
    index: "04",
    nav: "Air",
    kicker: "Kepulauan Gili · timur",
    title: "Gili Air",
    body: "Yang paling dekat ke daratan Lombok. Desa nelayan masih berjalan di antara losmen, dan terumbu di sekelilingnya mudah dicapai dari pantai.",
    facts: [
      { label: "Letak", value: "Terdekat" },
      { label: "Desa", value: "Nelayan" },
      { label: "Tepi", value: "Terumbu" },
    ],
    center: [116.0818, -8.3576],
    zoom: 15.4,
    pitch: 58,
    bearing: 52,
  },
];

const REF_WIDTH = 900;

export type Camera = {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number) {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return a + delta * t;
}

function segmentEase(t: number, reduce: boolean) {
  if (reduce) return t < 0.5 ? 0 : 1;
  return t * t * (3 - 2 * t);
}

export function zoomForViewport(zoom: number, width: number) {
  const adjusted = zoom + Math.log2(clamp(width, 320, 1920) / REF_WIDTH);
  return clamp(adjusted, 2, 16.6);
}

export function cameraAt(progress: number, width: number, reduce: boolean): Camera {
  const n = STOPS.length - 1;
  const x = clamp(progress, 0, 1) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const f = segmentEase(x - i, reduce);
  const a = STOPS[i]!;
  const b = STOPS[Math.min(i + 1, n)]!;
  return {
    center: [lerp(a.center[0], b.center[0], f), lerp(a.center[1], b.center[1], f)],
    zoom: zoomForViewport(lerp(a.zoom, b.zoom, f), width),
    pitch: lerp(a.pitch, b.pitch, f),
    bearing: lerpAngle(a.bearing, b.bearing, f),
  };
}

export function activeIndex(progress: number) {
  return Math.round(clamp(progress, 0, 1) * (STOPS.length - 1));
}

export function formatCamera(cam: Camera) {
  const [lng, lat] = cam.center;
  const ns = lat < 0 ? "S" : "N";
  const ew = lng < 0 ? "W" : "E";
  return `${Math.abs(lat).toFixed(3)}°${ns}  ${Math.abs(lng).toFixed(3)}°${ew}  ·  ${Math.round(cam.pitch)}°`;
}
