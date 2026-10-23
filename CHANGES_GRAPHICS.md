# Graphics upgrade

- Added persisted Auto, Low, Medium, and High quality choices. Auto starts at Low/Medium on mobile-class devices and High on desktop, then can adapt downward if frame rate drops.
- Raised High's pixel-ratio ceiling to 2, with larger soft shadows, SSAO, anti-aliasing, and reflection support. Low keeps the lightweight no-postprocessing/no-shadow path.
- Upgraded the hero bikes, quad, car, rider, buildings, roads, and key landmark surfaces to physically based materials with tuned paint, chrome, glass, rubber, asphalt, masonry, and fabric finishes. Low keeps a matching legacy city-material path for mobile speed.
- Added procedurally generated sunset and night skies, filtered through `PMREMGenerator` for `scene.environment` reflections without new assets or downloads.
- Connected each `models/walls/wall_*_n.jpg` texture to its matching building material as a real normal map.
- Added a persisted Sunset/Night lighting toggle. Night enables brighter emissive windows, signs and streetlights, stronger light pools, colored fog, and bloom on supported quality levels.
- Replaced the costly live cube-camera reflection refresh with static procedural environment maps, preserving mobile Safari performance.
- Bumped the offline service-worker cache from `rob-v2` to `rob-v3`.
