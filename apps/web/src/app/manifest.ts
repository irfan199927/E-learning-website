import type { MetadataRoute } from "next";

/** Installable app ("Add to Home screen"). Opens on the signed-in Overview; icons in public/icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "E-learner",
    short_name: "E-learner",
    description: "Live classes, recorded lessons and schedules for your school.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F6F7F9",
    theme_color: "#2340D9",
    lang: "en-IN",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
