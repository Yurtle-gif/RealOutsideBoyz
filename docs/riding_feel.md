# Riding feel: before / after (fixed-step sim, 120 Hz, boat-house lot, same build with RIDE reset to old values for 'before')

| bike | cfg | 0-40 km/h s | km/h @8s | pinned-gas loop-out s | radius @25 km/h m | radius @50 km/h m | steer 0->90% s | throttle 0->90% s | 1.5 m drop airtime s |
|---|---|---|---|---|---|---|---|---|---|
| Bike | before | 7.73 | 40.6 | 3.3 | 5.9 | 11.1 | 0.14 | instant | 0.55 |
| ROB YZ | before | 7.73 | 40.6 | 3.3 | 5.9 | 11.1 | 0.14 | instant | 0.55 |
| CRF150R | before | 7.73 | 40.6 | 3.3 | 5.9 | 11.1 | 0.14 | instant | 0.55 |
| Ultra Bee | before | 7.73 | 40.6 | 3.3 | 5.9 | 11.1 | 0.14 | instant | 0.55 |
| Bike | after | 7.99 | 40 | 3.62 | 5.9 | 15.2 | 0.33 | 0.46 | 0.48 |
| ROB YZ | after | 7.47 | 41.4 | 3.55 | 5.9 | 15.2 | 0.33 | 0.46 | 0.48 |
| CRF150R | after | 6.63 | 44.1 | 3.43 | 6.2 | 16 | 0.33 | 0.46 | 0.48 |
| Ultra Bee | after | >8 | 37.4 | 3.78 | 5.3 | 13.6 | 0.33 | 0.46 | 0.49 |

Slide (brake + steer from 36 km/h): rear steps out to 0.43 rad, 103 deg of rotation and 21.6 km/h after 1 s. Wall bail 24 -> 30 km/h; loop-out gets a 0.3 s save window. Lean target 0.42 -> 0.55 rad, eased at 6/s.
