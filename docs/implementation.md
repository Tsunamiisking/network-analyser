# Network Analyser — Technical Implementation Summary

> Reference document for thesis methodology and results writing. Covers all system components, design decisions, and limitations.

---

## 1. System Overview

**Network Analyser** is a crowdsourced mobile network quality monitoring system for Nigeria. It passively collects signal quality data from smartphones, stores it centrally, and surfaces it through an admin dashboard.

**Research scope:** Four Nigerian carriers — MTN, Airtel, Glo, 9mobile — across the Nigerian geographic boundary (lat 4.0–14.0, lng 2.6–15.0).

| Component | Technology | Role |
|---|---|---|
| Mobile App | Expo SDK 54 (React Native) | Data collection & participatory reporting |
| Backend API | Node.js / Express v5 | REST API, ingestion, analytics aggregation |
| Database | MongoDB Atlas | Persistent storage |
| Cache | Redis (5-min TTL) | Heatmap query acceleration |
| Admin Dashboard | React 19 / Vite | Visualisation & reporting |

**Architecture:** All three components are decoupled and communicate via HTTP/REST (JSON). No direct database access from any client.

```
Mobile App  ──POST /api──▶  Backend (Express)  ──▶  MongoDB Atlas
                                   ▲                      │
Admin Dashboard  ──GET /api──────┘              Redis Cache
```

---

## 2. Mobile Application

**Stack:** Expo SDK 54 (managed workflow), expo-router v6, AsyncStorage, native `fetch`, no Redux.

### Sensing Pipeline (`sensingService.js`)

Runs every **5 minutes**; switches to a **1-minute emergency cycle** on signal drops ≥10 dBm.

Each cycle:
1. GPS fix via `expo-location`
2. Ping `/health` endpoint → measure round-trip latency (ms)
3. Map latency → dBm proxy (see §5)
4. Read carrier name + network generation via `expo-cellular`
5. Set `connectivityFlag = false` on timeout (blackout sample)
6. POST telemetry packet to backend, or queue in AsyncStorage if offline

### Background Collection (`backgroundCollectionService.js`)

- Managed via `expo-task-manager` + `expo-background-fetch`
- Target interval: **10 minutes** (iOS OS minimum ~15 min enforced by system)
- Skips collection if battery < 15% (unless charging)
- User can disable via in-app settings (stored in AsyncStorage)

### Participatory Reporting

Manual report fields: **provider**, **issue type** (No Signal / Slow Internet / Call Drop / No Data), **description**, **GPS location** (auto-filled), **occurredAt** (optional timestamp of when issue happened).

The `occurredAt` vs `timestamp` gap is used to compute *reporting lag*, surfaced in the admin dashboard.

---

## 3. Backend API

**Stack:** Node.js, Express v5, Mongoose, Redis client, `ngeohash`, `density-clustering`, `morgan`, `dotenv`. Port 3000.

### Input Validation (`POST /api/networks`)

1. Required fields: `provider`, `signalStrength`, `networkType`, `location`
2. Nigeria bounding box check — rejects coordinates outside [4.0–14.0 lat, 2.6–15.0 lng]
3. Signal range check — rejects values outside [−140, −44] dBm (3GPP RSRP range)
4. Computes `geohash` via `ngeohash.encode(lat, lng, 6)` and stores it on the document

### Analytics Pipelines

**Provider comparison** (`GET /api/analytics/provider-comparison`):
- `$addFields` → normalise provider to lowercase
- `$group` by normalised key → avg signal, total count
- `$project` with `$switch` → output canonical names (MTN, Airtel, Glo, 9mobile)

**Blackout rate** (`GET /api/analytics/blackout-rate`):
- Same normalisation; additionally counts `connectivityFlag = false` samples per provider
- Returns `blackoutRate = (blackoutSamples / totalSamples) × 100`

**Aggregated heatmap** (`GET /api/networks/heatmap/aggregated`):
- `$group` by geohash prefix of length `precision` (4–6) → collects all `signalStrengths[]`
- Median computed in JavaScript post-aggregation (avoids Atlas tier limitations on `$percentile`)
- `ngeohash.decode()` maps each cell back to a lat/lng centre point
- Result cached in Redis for 5 minutes

---

## 4. Database Design

### Collection: `networkdatas`

| Field | Type | Notes |
|---|---|---|
| `provider` | String | MTN / Airtel / Glo / 9mobile |
| `signalStrength` | Number | dBm proxy, −130 to −44 |
| `networkType` | String | 2G / 3G / 4G / 5G |
| `location` | GeoJSON Point | `[lng, lat]` (GeoJSON order) |
| `geohash` | String | Precision-6, ~1.2 km cell |
| `connectivityFlag` | Boolean | `false` = blackout sample |
| `rsrp` / `rsrq` | Number | null in managed workflow |
| `deviceId` | String | Anonymous identifier |
| `timestamp` | Date | Time of measurement |

**Indexes:** 2dsphere on `location`; single on `geohash`, `connectivityFlag`; compound on `deviceId+timestamp` and `provider+geohash+timestamp`.

### Collection: `reports`

| Field | Type | Notes |
|---|---|---|
| `provider` | String (enum) | MTN / Airtel / Glo / 9mobile |
| `issueType` | String (enum) | No Signal / Slow Internet / Call Drop / No Data |
| `description` | String | Free text |
| `location` | GeoJSON Point | GPS at submission time |
| `timestamp` | Date | Submission time |
| `occurredAt` | Date (optional) | Actual time of issue |

**Indexes:** 2dsphere on `location`; compound on `provider+timestamp`.

---

## 5. Signal Strength Proxy Method

**Problem:** Expo managed workflow cannot access cellular radio APIs (RSRP/RSRQ). `expo-cellular` provides carrier name and network type only. iOS additionally blocks carrier name on iOS 16+.

**Solution:** Active latency test — ping `/health`, measure RTT, map to dBm-equivalent:

| Latency (ms) | Signal proxy (dBm) | Quality |
|---|---|---|
| < 50 | −55 | Excellent |
| 50–99 | −70 | Good |
| 100–199 | −85 | Fair |
| 200–399 | −100 | Poor |
| ≥ 400 | −115 | Very Poor |
| Timeout | −130 | No connection |

**Validity:** Latency correlates with signal quality under normal conditions (poor signal → retransmissions → higher RTT). The proxy is valid for **relative/comparative analysis** between carriers and locations. It is a step function (5 discrete levels) and is influenced by server-side and routing factors, so it is not equivalent to a calibrated RSRP measurement.

The `rsrp`/`rsrq` schema fields exist for future bare-workflow upgrades where true radio measurements would be available via Android TelephonyManager.

---

## 6. Admin Dashboard

**Stack:** Vite v8, React 19.2, react-router-dom v6, Recharts, Tailwind CSS v4, lucide-react, native `fetch`.

**Three pages:**

| Page | Key Content |
|---|---|
| **Overview** | 4 stat cards, provider signal BarChart, blackout rate bars, sample quality distribution, 8 recent reports. Auto-refreshes every 60 s. |
| **Reports** | Paginated table (20/page) with server-side provider filter, client-side issue type + text search. Lag badge if `occurredAt` > 5 min before submission. |
| **Analytics** | Signal BarChart, sample count BarChart, blackout rate chart, coverage quality PieChart, signal quality RadarChart (0–100 score), provider summary table. Date range filter (all / 30d / 7d). |

**Signal chart rendering fix:** Recharts defaults `baseValue = 0`; negative dBm values rendered bars inverted. Fix: `signalScore = dBm + 130` (shifts to positive), tick/tooltip formatters subtract 130 for display.

**Signal quality score formula** (RadarChart):
$$score = \text{round}\left(\max\!\left(0,\min\!\left(100, \frac{dBm + 130}{75} \times 100\right)\right)\right)$$

---

## 7. API Reference

| Method | Endpoint | Key Params | Purpose |
|---|---|---|---|
| POST | `/api/networks` | body: telemetry JSON | Ingest sensing reading |
| GET | `/api/networks/heatmap` | provider, dates, bbox | Raw readings (max 5000) |
| GET | `/api/networks/heatmap/aggregated` | precision (4–6), provider, dates, bbox | Geohash-grouped median signal |
| GET | `/api/networks/best` | lat, lng, radius | Best carrier near a point |
| GET | `/api/networks/deadzones` | bbox | DBSCAN-detected dead zones |
| GET | `/api/networks/history` | deviceId, limit | Per-device history |
| GET | `/api/analytics/provider-comparison` | — | Avg signal + count per carrier |
| GET | `/api/analytics/blackout-rate` | startDate, endDate | Blackout % per carrier |
| POST | `/api/reports` | body: report JSON | Submit participatory report |
| GET | `/api/reports` | provider, limit, skip | List reports |
| GET | `/health` | — | Latency probe endpoint |

---

## 8. Key Design Decisions

| Decision | Rationale |
|---|---|
| **Crowdsourced sensing** | No dedicated hardware; smartphones provide geographic breadth at zero infrastructure cost |
| **Latency proxy for signal** | Only option under Expo managed workflow; valid for comparative analysis |
| **`connectivityFlag = false` on blackout** | Prevents survivorship bias — offline queue replays blackout samples later so dead zones are not excluded from the dataset |
| **Median aggregation per geohash cell** | Robust to outlier readings; computed in JS post-pipeline due to Atlas `$percentile` tier limitations |
| **Geohash precision 6 (~1.2 km)** | Balances spatial granularity with minimum sample density per cell at prototype scale |
| **Redis 5-min TTL on heatmap** | Heatmap aggregation is the costliest query; caching eliminates redundant pipeline runs |
| **Provider name normalisation** | Test data had lowercase names; `$toLower` + `$switch` in pipeline normalises without altering stored documents |
| **No authentication** | Research prototype; production would require API key auth on write endpoints |

---

## 9. Clustering & Spatial Indexing

**Geohash:** Encodes lat/lng into a string where nearby points share a common prefix. Precision 4 ≈ 40 km, 5 ≈ 5 km, 6 ≈ 1.2 km. Prefix-truncation of precision-6 hashes enables multi-zoom aggregation from the same stored data.

**MongoDB 2dsphere index:** Required for `$geoNear`, `$geoWithin`, `$nearSphere`. Used by heatmap bounding-box filters and the "best network near me" query.

**DBSCAN dead zone detection:** Density-based clustering (no fixed k) using Haversine distance. Dead zones = clusters of `connectivityFlag = false` points. Isolated failures classified as noise and excluded.

$$d = 2R \cdot \arctan2\!\left(\sqrt{a},\sqrt{1-a}\right), \quad a = \sin^2\!\tfrac{\Delta\phi}{2} + \cos\phi_1\cos\phi_2\sin^2\!\tfrac{\Delta\lambda}{2}$$

---

## 10. Known Limitations

| Limitation | Impact |
|---|---|
| Latency-based signal proxy | Step-function (5 levels), influenced by server/routing; not equivalent to RSRP |
| iOS carrier name blocked (iOS 16+) | Provider may be null on iOS; affects per-carrier analysis accuracy |
| iOS BGFetch minimum ~15 min | Lower data density from iOS devices than Android |
| Nigeria geographic scope only | Bounding box validation hardcoded in `networkController.js` |
| No authentication on write endpoints | Anyone with the URL can submit data (acceptable for prototype) |
| No deduplication | Offline queue replay can create duplicate documents |
| Expo managed workflow | Blocks direct RSRP/RSRQ access; bare workflow would enable real measurements |

---

*Network Analyser — Crowdsourced Mobile Network Quality Monitoring for Nigeria*
