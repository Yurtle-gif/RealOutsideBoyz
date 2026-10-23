# Graphics upgrade

- Added persisted Auto, Low, Medium, and High quality choices. Auto starts at Low/Medium on mobile-class devices and High on desktop, then can adapt downward if frame rate drops.
- Raised High's pixel-ratio ceiling to 2, with larger soft shadows, SSAO, anti-aliasing, and reflection support. Low keeps the lightweight no-postprocessing/no-shadow path.
- Upgraded the hero bikes, quad, car, rider, buildings, roads, and key landmark surfaces to physically based materials with tuned paint, chrome, glass, rubber, asphalt, masonry, and fabric finishes. Low keeps a matching legacy city-material path for mobile speed.
- Added procedurally generated sunset and night skies, filtered through `PMREMGenerator` for `scene.environment` reflections without new assets or downloads.
- Connected each `models/walls/wall_*_n.jpg` texture to its matching building material as a real normal map.
- Added a persisted Sunset/Night lighting toggle. Night enables brighter emissive windows, signs and streetlights, stronger light pools, colored fog, and bloom on supported quality levels.
- Replaced the costly live cube-camera reflection refresh with static procedural environment maps, preserving mobile Safari performance.
- Bumped the offline service-worker cache from `rob-v2` to `rob-v3`.

## Realism correction (rob-v4)

- Rebuilt the asphalt response around a procedural 4 m world-space tile with mipmaps, `RepeatWrapping`, quality-aware anisotropic filtering, subtle aggregate/cracks, and matte road values (`roughness 0.94`, zero metalness). Added lane-following tire wear while retaining the existing lane, bike, bus, arrow, and stop-line layout.
- Added crosswalks to signalized and major junction approaches when the source map has no explicit crossing node. Curbs now have a visible top and a true 15 cm face up to the raised, rough concrete sidewalk; rideable-height and collision behavior are unchanged.
- Corrected the existing `wall_*.jpg` and `wall_*_n.jpg` façade scale to their authored four-bay-by-three-floor size (12 m × 10.2 m), with sRGB only on color maps, linear normal maps, mipmaps, and anisotropic filtering.
- Removed the glossy/plastic response from asphalt, masonry, siding, concrete, and corrugated walls. Added slimmer roof parapets/cornices, segmented storefront glazing with mullions and doors, and a subtle gradient contact shadow at building bases.
- Neutralized the overly purple fog/ground light and reduced ACES exposure slightly so sunset colors remain saturated without crushing streets and façades. Low keeps Lambert road/façade peers and skips tire-wear/base-AO detail meshes.
- Bumped the offline service-worker cache from `rob-v3` to `rob-v4`.
