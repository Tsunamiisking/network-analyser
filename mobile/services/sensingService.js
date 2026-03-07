/**
 * sensingService.js
 * 
 * Passive + participatory sensing engine for the Network Analyser with Geo Map.
 * Compatible with React Native Expo (managed workflow).
 * 
 * Android: expo-cellular provides networkType + carrier.
 *          Active latency test derives a signalStrength proxy.
 *          connectivityFlag sourced from expo-network.
 * 
 * iOS:     Same active quality tests. RSRP/RSRQ remain null per OS restrictions
 *          (documented in report §3.4.1). Carrier/networkType via expo-cellular
 *          where permitted by iOS privacy policy.
 * 
 * Install dependencies:
 *   npx expo install expo-cellular expo-location expo-network
 */

import * as Cellular from "expo-cellular";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { Platform } from "react-native";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://your-backend.onrender.com";
const SENSING_INTERVAL_MS = 5 * 60 * 1000;       // 5 minutes — normal cycle
const EMERGENCY_INTERVAL_MS = 60 * 1000;          // 1 minute — triggered on signal drop
const RSRP_DROP_THRESHOLD_DBM = 10;               // Emergency cycle trigger threshold
const LATENCY_PING_TIMEOUT_MS = 5000;             // Max wait for latency test
const OFFLINE_QUEUE_KEY = "offlineQueue";          // AsyncStorage key for queued packets

// ─── LATENCY → SIGNAL STRENGTH MAPPING ───────────────────────────────────────
// Maps measured round-trip latency (ms) to a dBm-equivalent proxy signal strength.
// This is an approximation used in place of direct RSRP on Expo managed workflow.
// Scale mirrors the RSRP range documented in §3.4.1 (−44 dBm to −140 dBm).
//
//  Latency (ms)  │  Proxy signalStrength (dBm)  │  Quality
//  ──────────────┼─────────────────────────────┼──────────
//   < 50         │  −55                         │  Excellent
//   50 – 100     │  −70                         │  Good
//   100 – 200    │  −85                         │  Fair
//   200 – 400    │  −100                        │  Poor
//   > 400        │  −115                        │  Very poor
//   Timeout      │  −130                        │  No connection (blackout proxy)

function latencyToSignalStrength(latencyMs) {
  if (latencyMs === null)      return -130;
  if (latencyMs < 50)          return -55;
  if (latencyMs < 100)         return -70;
  if (latencyMs < 200)         return -85;
  if (latencyMs < 400)         return -100;
  return -115;
}

// ─── ACTIVE LATENCY TEST ─────────────────────────────────────────────────────
// Pings the backend /health endpoint and measures round-trip time.
// Returns null on timeout or network failure (used to set connectivityFlag = false).

async function measureLatency() {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LATENCY_PING_TIMEOUT_MS);

    await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);
    return Date.now() - start;
  } catch {
    return null; // Timeout or no connection
  }
}

// ─── CELLULAR METADATA ───────────────────────────────────────────────────────
// Reads carrier name and network generation via expo-cellular.
// Returns safe fallback strings on permission denial or unsupported hardware.

async function getCellularMetadata() {
  try {
    const [carrier, generation] = await Promise.all([
      Cellular.getCarrierNameAsync(),
      Cellular.getCellularGenerationAsync(),
    ]);

    // Map expo-cellular generation enum to human-readable string
    const generationMap = {
      [Cellular.CellularGeneration.CELLULAR_2G]: "2G",
      [Cellular.CellularGeneration.CELLULAR_3G]: "3G",
      [Cellular.CellularGeneration.CELLULAR_4G]: "4G",
      [Cellular.CellularGeneration.CELLULAR_5G]: "5G",
      [Cellular.CellularGeneration.UNKNOWN]: "Unknown",
    };

    return {
      provider: carrier || "Unknown",
      networkType: generationMap[generation] || "Unknown",
    };
  } catch {
    return { provider: "Unknown", networkType: "Unknown" };
  }
}

// ─── GPS LOCATION ─────────────────────────────────────────────────────────────

async function getCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch {
    return null;
  }
}

// ─── CONNECTIVITY FLAG ────────────────────────────────────────────────────────
// connectivityFlag = true  → device has an active data connection
// connectivityFlag = false → device is offline (blackout event)
// This is the primary mechanism for capturing outage periods that traditional
// active-test platforms miss (survivorship bias — see Chapter Two, §2.5).

async function getConnectivityFlag() {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected && state.isInternetReachable;
  } catch {
    return false;
  }
}

// ─── ASSEMBLE TELEMETRY PACKET ────────────────────────────────────────────────
// Builds a complete packet ready for POST /api/networks.
// rsrp and rsrq remain null on Expo managed workflow — the backend schema
// accepts null for these fields (default: null).

export async function assembleTelemetryPacket() {
  const [location, cellular, latencyMs, connectivityFlag] = await Promise.all([
    getCurrentLocation(),
    getCellularMetadata(),
    measureLatency(),
    getConnectivityFlag(),
  ]);

  if (!location) return null; // Cannot submit without GPS

  const signalStrength = latencyToSignalStrength(latencyMs);

  return {
    // Core required fields (always populated)
    latitude: location.latitude,
    longitude: location.longitude,
    provider: cellular.provider,
    networkType: cellular.networkType,
    signalStrength,

    // Anti-survivorship-bias flag
    connectivityFlag: connectivityFlag ?? false,

    // Modem-level RF metrics — null on Expo (iOS policy + managed workflow)
    // Populated by a bare workflow or native Android build in production.
    rsrp: null,
    rsrq: null,

    // Anonymised device identifier — generate once per install and persist
    deviceId: await getDeviceId(),

    // Active quality measurements (available on both platforms)
    latencyMs,
    platform: Platform.OS,
  };
}

// ─── DEVICE ID ────────────────────────────────────────────────────────────────
// Generates a stable anonymous identifier per device install.
// Not linked to any PII — used only for rate-limiting and deduplication.

import AsyncStorage from "@react-native-async-storage/async-storage";

async function getDeviceId() {
  try {
    let id = await AsyncStorage.getItem("deviceId");
    if (!id) {
      id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await AsyncStorage.setItem("deviceId", id);
    }
    return id;
  } catch {
    return null;
  }
}

// ─── OFFLINE QUEUE ────────────────────────────────────────────────────────────
// Packets captured during a blackout (connectivityFlag = false) are stored
// locally and flushed once connectivity is restored. This ensures that
// outage events are never silently discarded.

async function enqueuePacket(packet) {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(packet);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn("Failed to enqueue packet:", e);
  }
}

async function flushOfflineQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;

    const queue = JSON.parse(raw);
    if (queue.length === 0) return;

    const successful = [];
    for (const packet of queue) {
      const ok = await submitPacket(packet);
      if (ok) successful.push(packet);
    }

    // Remove only successfully submitted packets
    const remaining = queue.filter((p) => !successful.includes(p));
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.warn("Failed to flush offline queue:", e);
  }
}

// ─── SUBMIT TO BACKEND ────────────────────────────────────────────────────────

async function submitPacket(packet) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/networks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packet),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── MAIN SENSING LOOP ────────────────────────────────────────────────────────
// Runs as a background task. Adjusts interval based on signal drop detection.

let sensingInterval = null;
let lastSignalStrength = null;

export async function startPassiveSensing() {
  async function sense() {
    // First flush any queued offline packets now that we may have connectivity
    await flushOfflineQueue();

    const packet = await assembleTelemetryPacket();
    if (!packet) return;

    if (packet.connectivityFlag) {
      await submitPacket(packet);
    } else {
      // Device is offline — queue locally for later transmission
      await enqueuePacket(packet);
    }

    // Emergency cycle: shorten interval if signal has dropped significantly
    const isEmergency =
      lastSignalStrength !== null &&
      packet.signalStrength - lastSignalStrength < -RSRP_DROP_THRESHOLD_DBM;

    lastSignalStrength = packet.signalStrength;

    if (isEmergency && sensingInterval) {
      clearInterval(sensingInterval);
      sensingInterval = setInterval(sense, EMERGENCY_INTERVAL_MS);
      // Revert to normal interval after 10 minutes
      setTimeout(() => {
        if (sensingInterval) {
          clearInterval(sensingInterval);
          sensingInterval = setInterval(sense, SENSING_INTERVAL_MS);
        }
      }, 10 * 60 * 1000);
    }
  }

  // Run immediately, then on interval
  await sense();
  sensingInterval = setInterval(sense, SENSING_INTERVAL_MS);
}

export function stopPassiveSensing() {
  if (sensingInterval) {
    clearInterval(sensingInterval);
    sensingInterval = null;
  }
}

// ─── PARTICIPATORY REPORT SUBMISSION ─────────────────────────────────────────
// Submits a manual outage report from the user interface.
// Available on both Android and iOS — does not require modem access.
// If offline at submission time, queued and transmitted on reconnection.

export async function submitOutageReport({ provider, issueType, description }) {
  const location = await getCurrentLocation();
  if (!location) throw new Error("Location unavailable");

  const report = {
    provider,
    issueType,
    description: description || "",
    latitude: location.latitude,
    longitude: location.longitude,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new Error("Submission failed");
    return { success: true };
  } catch {
    // Queue for later if offline
    await enqueuePacket({ _type: "report", ...report });
    return { success: false, queued: true };
  }
}
