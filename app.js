"use strict";

// ---------------------------------------------------------------------------
// Konfiguration und zentraler State
// ---------------------------------------------------------------------------

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const DATA_CHARACTERISTIC_UUID = "12345678-1234-5678-1234-56789abcdef1";
const CONTROL_CHARACTERISTIC_UUID = "12345678-1234-5678-1234-56789abcdef2";
const STORAGE_KEY = "gymimu-training-mvp-v1";
const MAX_LIVE_CHART_SAMPLES = 700;
const OVERLAY_POINT_COUNT = 240;
const MIN_ANALYSIS_SAMPLES = 20;
const CHART_COLORS = ["#52e0a0", "#62a4ff", "#ffc857", "#b18cff", "#ff7f91", "#55d8e8"];

const defaultWeightStackOptions = {
  accUnit: "g", // "g", "mps2", "raw_mpu6050"
  mpuAccelRangeG: 4,
  lsbPerG: null,
  restMs: 1500,
  minRepMs: 700,
  maxRepMs: 9000,
  minPhaseMs: 220,
  refractoryMs: 250,
  cutoffHz: 6,
  velocityLeak: 0.995,
  positionLeak: 0.999,
  minActivityG: 0.025,
  enableRestCalibration: true,
  enableRestQualityCheck: true,
  enableMotionAxisPca: true,
  enableDominantAxisFallback: true,
  enableLowPassFilter: true,
  enableBoundedIntegration: true,
  enableZuptReset: true,
  enableStateMachine: true,
  enableMagnitudeMinusGDiagnostic: true,
  useMagnitudeMinusGAsPrimary: false,
  enableExperimentalDistance: false,
  cmPerPositionProxy: null,
  enableRomBaseline: true,
  enablePartialRepDetection: true,
  partialRepRomRatio: 0.75,
  enableTempoFlags: true,
  controlledDownMinMs: 600,
  enableDroppedWeightDetection: true,
  droppedWeightSpikeG: 0.45,
  enableJerkDetection: true,
  jerkThreshold: null,
  enableVelocityLoss: true,
  enableDebug: true,
  debugKeepArrays: true,
  // Backward-compatible optional/debug toggles from earlier MVP iterations.
  enableGyroAssist: false,
  enableAutocorrelationHint: false,
  enableTemplateMatching: false,
  enableExerciseProfiles: true,
  startVelocityThreshold: null,
  minAmplitude: null,
};

const WEIGHT_STACK_EXERCISE_PROFILES = {
  default: {
    minRepMs: 700,
    maxRepMs: 8000,
    minPhaseMs: 250,
    controlledDownMinMs: 600,
    partialRepRomRatio: 0.75,
  },
  lat_pulldown: {
    minRepMs: 900,
    maxRepMs: 9000,
    controlledDownMinMs: 700,
  },
  leg_extension: {
    minRepMs: 700,
    maxRepMs: 7000,
    controlledDownMinMs: 600,
  },
};

let lastWeightStackRepDebug = {
  mode: "not_run",
  warning: "Weight-stack detector has not run yet.",
};

const elements = {
  message: document.querySelector("#message"),
  connectionStatus: document.querySelector("#connectionStatus"),
  demoStatus: document.querySelector("#demoStatus"),
  recordingBadge: document.querySelector("#recordingBadge"),
  dashboardCards: document.querySelector("#dashboardCards"),
  lastSetTitle: document.querySelector("#lastSetTitle"),
  lastSetScore: document.querySelector("#lastSetScore"),
  lastSetContent: document.querySelector("#lastSetContent"),
  exerciseList: document.querySelector("#exerciseList"),
  exerciseForm: document.querySelector("#exerciseForm"),
  exerciseFormTitle: document.querySelector("#exerciseFormTitle"),
  exerciseId: document.querySelector("#exerciseId"),
  exerciseName: document.querySelector("#exerciseName"),
  equipmentType: document.querySelector("#equipmentType"),
  muscleGroup: document.querySelector("#muscleGroup"),
  exerciseWeight: document.querySelector("#exerciseWeight"),
  targetReps: document.querySelector("#targetReps"),
  setType: document.querySelector("#setType"),
  sensorPosition: document.querySelector("#sensorPosition"),
  analysisMode: document.querySelector("#analysisMode"),
  exerciseNotes: document.querySelector("#exerciseNotes"),
  newExerciseButton: document.querySelector("#newExerciseButton"),
  cancelExerciseButton: document.querySelector("#cancelExerciseButton"),
  recordingExerciseSelect: document.querySelector("#recordingExerciseSelect"),
  analysisExerciseSelect: document.querySelector("#analysisExerciseSelect"),
  exportExerciseSelect: document.querySelector("#exportExerciseSelect"),
  exportRecordingSelect: document.querySelector("#exportRecordingSelect"),
  demoProfile: document.querySelector("#demoProfile"),
  connectButton: document.querySelector("#connectButton"),
  demoButton: document.querySelector("#demoButton"),
  calibrateButton: document.querySelector("#calibrateButton"),
  audioFeedbackToggle: document.querySelector("#audioFeedbackToggle"),
  debugSampleCount: document.querySelector("#debugSampleCount"),
  startReferenceButton: document.querySelector("#startReferenceButton"),
  startSetButton: document.querySelector("#startSetButton"),
  stopButton: document.querySelector("#stopButton"),
  discardButton: document.querySelector("#discardButton"),
  saveRecordingButton: document.querySelector("#saveRecordingButton"),
  recordingModeValue: document.querySelector("#recordingModeValue"),
  analysisModeValue: document.querySelector("#analysisModeValue"),
  recordingTime: document.querySelector("#recordingTime"),
  sampleCount: document.querySelector("#sampleCount"),
  liveRepCount: document.querySelector("#liveRepCount"),
  liveExerciseName: document.querySelector("#liveExerciseName"),
  sampleTimestamp: document.querySelector("#sampleTimestamp"),
  recordingPreview: document.querySelector("#recordingPreview"),
  subjectiveSetPanel: document.querySelector("#subjectiveSetPanel"),
  setRpe: document.querySelector("#setRpe"),
  setRir: document.querySelector("#setRir"),
  setNote: document.querySelector("#setNote"),
  analysisEmpty: document.querySelector("#analysisEmpty"),
  analysisContent: document.querySelector("#analysisContent"),
  recordingCheckboxes: document.querySelector("#recordingCheckboxes"),
  overlayLegend: document.querySelector("#overlayLegend"),
  metricsTableBody: document.querySelector("#metricsTableBody"),
  feedbackList: document.querySelector("#feedbackList"),
  showRepMarkers: document.querySelector("#showRepMarkers"),
  exportAllButton: document.querySelector("#exportAllButton"),
  importButton: document.querySelector("#importButton"),
  importFileInput: document.querySelector("#importFileInput"),
  downloadCurrentCsvButton: document.querySelector("#downloadCurrentCsvButton"),
  downloadSavedCsvButton: document.querySelector("#downloadSavedCsvButton"),
  exportExerciseButton: document.querySelector("#exportExerciseButton"),
  deleteAllButton: document.querySelector("#deleteAllButton"),
  accChart: document.querySelector("#accChart"),
  gyroChart: document.querySelector("#gyroChart"),
  accOverlayChart: document.querySelector("#accOverlayChart"),
  gyroOverlayChart: document.querySelector("#gyroOverlayChart"),
  liveSecondaryChartCard: document.querySelector("#liveSecondaryChartCard"),
  overlaySecondaryChartCard: document.querySelector("#overlaySecondaryChartCard"),
  livePrimaryChartTitle: document.querySelector("#livePrimaryChartTitle"),
  liveSecondaryChartTitle: document.querySelector("#liveSecondaryChartTitle"),
  overlayPrimaryTitle: document.querySelector("#overlayPrimaryTitle"),
  overlaySecondaryTitle: document.querySelector("#overlaySecondaryTitle"),
  metricChartOne: document.querySelector("#metricChartOne"),
  metricChartTwo: document.querySelector("#metricChartTwo"),
  metricChartThree: document.querySelector("#metricChartThree"),
  metricChartFour: document.querySelector("#metricChartFour"),
  metricChartOneTitle: document.querySelector("#metricChartOneTitle"),
  metricChartTwoTitle: document.querySelector("#metricChartTwoTitle"),
  metricChartThreeTitle: document.querySelector("#metricChartThreeTitle"),
  metricChartFourTitle: document.querySelector("#metricChartFourTitle"),
  values: {
    ax: document.querySelector("#axValue"),
    ay: document.querySelector("#ayValue"),
    az: document.querySelector("#azValue"),
    gx: document.querySelector("#gxValue"),
    gy: document.querySelector("#gyValue"),
    gz: document.querySelector("#gzValue"),
    accMagnitude: document.querySelector("#accMagnitudeValue"),
    gyroMagnitude: document.querySelector("#gyroMagnitudeValue"),
  },
};

let appState = loadState();
let activeTab = "dashboard";
let selectedAnalysisRecordingIds = new Set();
let editingExerciseId = null;
let selectedExportExerciseId = appState.selectedExerciseId;

let bluetoothDevice = null;
let dataCharacteristic = null;
let controlCharacteristic = null;
let notificationBuffer = "";

let samples = [];
let recording = false;
let recordingMode = null;
let recordingStartedAt = 0;
let recordedDurationMs = 0;
let recordingTimerId = null;
let pendingRecording = null;
let liveAnalysis = emptyMetrics();

let demoIntervalId = null;
let demoStartedAt = 0;
let demoRecordingStartedAt = 0;
let demoLastTickAt = 0;
let demoPhase = 0;
let messageTimeoutId = null;
let calibrationActive = false;
let calibrationSamples = [];
let calibrationTimerId = null;
let audioFeedbackEnabled = false;
let audioQueue = [];
let audioProcessing = false;
let lastAudioAt = 0;
let audioEventCounts = {};
let lastAudioRepCount = 0;
let cleanRepOptionalSpoken = false;
let audioCooldownMs = 2500;

// ---------------------------------------------------------------------------
// Storage und Datenmodell
// ---------------------------------------------------------------------------

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createInitialState() {
  const starterId = createId();
  return {
    version: 1,
    selectedExerciseId: starterId,
    sessions: [],
    exercises: [
      {
        id: starterId,
        name: "Brustpresse",
        equipmentType: "Geführte Maschine",
        muscleGroup: "Brust",
        weight: "",
        targetReps: 10,
        setType: "hypertrophy",
        sensorPosition: "Gewichtsblock",
        analysisMode: "weight_stack",
        calibrationProfile: null,
        notes: "Beispielübung – kann bearbeitet oder gelöscht werden.",
        referenceRecording: null,
        setRecordings: [],
      },
    ],
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return createInitialState();
    }
    return normalizeImportedState(JSON.parse(stored));
  } catch (error) {
    console.warn("Gespeicherter State konnte nicht geladen werden.", error);
    return createInitialState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    return true;
  } catch (error) {
    showMessage(
      `Daten konnten nicht lokal gespeichert werden. Möglicherweise ist der Browser-Speicher voll: ${friendlyError(error)}`,
      "error",
      true,
    );
    return false;
  }
}

function normalizeImportedState(input) {
  if (!input || !Array.isArray(input.exercises)) {
    throw new Error("Die JSON-Datei enthält kein gültiges GymIMU-Datenmodell.");
  }

  const exercises = input.exercises.map((exercise) => {
    const normalizedExercise = {
    id: String(exercise.id || createId()),
    name: String(exercise.name || "Unbenannte Übung"),
    equipmentType: String(exercise.equipmentType || ""),
      muscleGroup: String(exercise.muscleGroup || ""),
      weight: String(exercise.weight || ""),
      targetReps: Number(exercise.targetReps) || "",
      setType: normalizeSetType(exercise.setType),
      sensorPosition: String(exercise.sensorPosition || ""),
    analysisMode: normalizeAnalysisMode(exercise.analysisMode, exercise.equipmentType),
    notes: String(exercise.notes || ""),
    calibrationProfile: normalizeCalibrationProfile(exercise.calibrationProfile),
    referenceRecording: null,
    setRecordings: [],
    };
    normalizedExercise.referenceRecording = normalizeRecording(exercise.referenceRecording, normalizedExercise);
    normalizedExercise.setRecordings = Array.isArray(exercise.setRecordings)
      ? exercise.setRecordings.map((recordingData) => normalizeRecording(recordingData, normalizedExercise)).filter(Boolean)
      : [];
    return normalizedExercise;
  });

  const selectedExists = exercises.some((exercise) => exercise.id === input.selectedExerciseId);
  return {
    version: 1,
    selectedExerciseId: selectedExists ? input.selectedExerciseId : exercises[0]?.id || null,
    sessions: normalizeSessions(input.sessions),
    exercises,
  };
}

function normalizeSessions(sessions) {
  return Array.isArray(sessions)
    ? sessions.map((session) => ({
        id: String(session.id || createId()),
        date: isValidDate(session.date) ? session.date : new Date().toISOString(),
        sets: Array.isArray(session.sets) ? session.sets : [],
      }))
    : [];
}

function normalizeAnalysisMode(value, equipmentType = "") {
  const validModes = new Set(["weight_stack", "barbell", "cable_handle", "free_movement", "body_segment"]);
  if (validModes.has(value)) return value;
  const text = String(equipmentType || "").toLowerCase();
  if (text.includes("kabel")) return "cable_handle";
  if (text.includes("hantel") || text.includes("stange")) return "barbell";
  if (text.includes("frei")) return "free_movement";
  return "weight_stack";
}

function normalizeSetType(value) {
  const validTypes = new Set(["technique", "hypertrophy", "strength", "explosive", "warmup"]);
  return validTypes.has(value) ? value : "hypertrophy";
}

function normalizeCalibrationProfile(profile) {
  if (!profile) return null;
  const keys = ["ax", "ay", "az", "gx", "gy", "gz"];
  const bias = profile.bias || profile;
  if (!keys.every((key) => Number.isFinite(Number(bias[key])))) return null;
  return {
    createdAt: isValidDate(profile.createdAt) ? profile.createdAt : new Date().toISOString(),
    sampleCount: Number(profile.sampleCount) || 0,
    bias: Object.fromEntries(keys.map((key) => [key, Number(bias[key])])),
  };
}

function normalizeRecording(recordingData, exercise = null) {
  if (!recordingData || !Array.isArray(recordingData.rawSamples)) {
    return null;
  }

  const rawSamples = recordingData.rawSamples.map(normalizeSample).filter(Boolean);
  const metrics = analyzeRecordingByMode(rawSamples, exercise || getSelectedExercise());
  return {
    id: String(recordingData.id || createId()),
    type: recordingData.type === "reference" ? "reference" : "set",
    name: String(recordingData.name || "Aufnahme"),
    createdAt: isValidDate(recordingData.createdAt)
      ? recordingData.createdAt
      : new Date().toISOString(),
    durationMs: Number(recordingData.durationMs) || metrics.durationMs,
    sampleCount: rawSamples.length,
    rawSamples,
    metrics: { ...(recordingData.metrics || {}), ...metrics },
    comparison: recordingData.comparison || null,
    subjective: normalizeSubjectiveSet(recordingData.subjective),
    session: normalizeSessionMeta(recordingData.session),
  };
}

function normalizeSubjectiveSet(subjective) {
  return {
    rpe: Number.isFinite(Number(subjective?.rpe)) ? Number(subjective.rpe) : null,
    rir: Number.isFinite(Number(subjective?.rir)) ? Number(subjective.rir) : null,
    note: String(subjective?.note || ""),
  };
}

function normalizeSessionMeta(session) {
  return {
    date: isValidDate(session?.date) ? session.date : new Date().toISOString(),
    exerciseId: String(session?.exerciseId || ""),
    exerciseName: String(session?.exerciseName || ""),
    weight: String(session?.weight || ""),
    targetReps: Number(session?.targetReps) || "",
    setType: normalizeSetType(session?.setType),
  };
}

function readSubjectiveSetInputs() {
  return normalizeSubjectiveSet({
    rpe: elements.setRpe.value,
    rir: elements.setRir.value,
    note: elements.setNote.value.trim(),
  });
}

function normalizeSample(sample) {
  if (!sample || !["timestamp", "ax", "ay", "az", "gx", "gy", "gz"].every((key) => Number.isFinite(Number(sample[key])))) {
    return null;
  }
  const normalized = {
    timestamp: Number(sample.timestamp),
    ax: Number(sample.ax),
    ay: Number(sample.ay),
    az: Number(sample.az),
    gx: Number(sample.gx),
    gy: Number(sample.gy),
    gz: Number(sample.gz),
  };
  const distanceValue = Number(sample.distanceMm ?? sample.ultrasoundMm);
  normalized.distanceMm = Number.isFinite(distanceValue) && distanceValue > 0 ? distanceValue : null;
  normalized.ultrasoundMm = normalized.distanceMm;
  normalized.hasUltrasound = Boolean(sample.hasUltrasound) || "distanceMm" in sample || "ultrasoundMm" in sample;
  normalized.ultrasoundValid = normalized.distanceMm !== null;
  normalized.accMagnitude = Number.isFinite(Number(sample.accMagnitude))
    ? Number(sample.accMagnitude)
    : Math.hypot(normalized.ax, normalized.ay, normalized.az);
  normalized.gyroMagnitude = Number.isFinite(Number(sample.gyroMagnitude))
    ? Number(sample.gyroMagnitude)
    : Math.hypot(normalized.gx, normalized.gy, normalized.gz);
  return normalized;
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function getSelectedExercise() {
  return appState.exercises.find((exercise) => exercise.id === appState.selectedExerciseId) || null;
}

function getExerciseById(id) {
  return appState.exercises.find((exercise) => exercise.id === id) || null;
}

function getExerciseRecordings(exercise) {
  if (!exercise) return [];
  return [exercise.referenceRecording, ...exercise.setRecordings].filter(Boolean);
}

function getRecordingById(exercise, recordingId) {
  return getExerciseRecordings(exercise).find((item) => item.id === recordingId) || null;
}

// ---------------------------------------------------------------------------
// BLE und Demo-Datenquelle
// ---------------------------------------------------------------------------

function isBluetoothConnected() {
  return Boolean(bluetoothDevice?.gatt?.connected && dataCharacteristic);
}

function isDemoActive() {
  return demoIntervalId !== null;
}

function hasDataSource() {
  return isBluetoothConnected() || isDemoActive();
}

async function connectBle() {
  clearMessage();
  if (!navigator.bluetooth) {
    showMessage(
      "Web Bluetooth wird nicht unterstützt. Nutze Android Chrome über HTTPS oder den Demo-Modus.",
      "error",
      true,
    );
    return;
  }

  stopDemo();

  try {
    setConnectionStatus("Gerät auswählen …", "offline");
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ name: "GymIMU" }],
      optionalServices: [SERVICE_UUID],
    });
    bluetoothDevice.addEventListener("gattserverdisconnected", handleDisconnect);

    setConnectionStatus("Verbinde …", "offline");
    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    dataCharacteristic = await service.getCharacteristic(DATA_CHARACTERISTIC_UUID);
    controlCharacteristic = await service.getCharacteristic(CONTROL_CHARACTERISTIC_UUID);

    await dataCharacteristic.startNotifications();
    dataCharacteristic.addEventListener("characteristicvaluechanged", handleNotification);
    notificationBuffer = "";
    setConnectionStatus(`Verbunden: ${bluetoothDevice.name || "GymIMU"}`, "online");
    showMessage("BLE-Verbindung hergestellt.", "success");
  } catch (error) {
    dataCharacteristic = null;
    controlCharacteristic = null;
    setConnectionStatus("Nicht verbunden", "offline");
    showMessage(`BLE-Verbindung fehlgeschlagen: ${friendlyError(error)}`);
  }

  renderAll();
}

function handleDisconnect() {
  dataCharacteristic = null;
  controlCharacteristic = null;
  notificationBuffer = "";

  if (recording && !isDemoActive()) {
    stopRecording(false);
  }

  if (isDemoActive()) {
    setConnectionStatus("Nicht verbunden", "offline");
  } else {
    setConnectionStatus("Verbindung getrennt", "offline");
    showMessage("Die BLE-Verbindung wurde getrennt.", "error", true);
  }
  renderAll();
}

function handleNotification(event) {
  const value = event.target.value;
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  notificationBuffer += new TextDecoder().decode(bytes);

  const lines = notificationBuffer.split(/\r?\n/);
  notificationBuffer = lines.pop() ?? "";
  lines.forEach((line) => processDataLine(line, "Bluetooth"));

  // Unterstützt auch Firmware, die pro Notification genau eine Zeile ohne LF sendet.
  if (isValidDataLine(notificationBuffer)) {
    processDataLine(notificationBuffer, "Bluetooth");
    notificationBuffer = "";
  }
}

async function writeControlCommand(command) {
  if (!controlCharacteristic) {
    throw new Error("Control Characteristic ist nicht verfügbar.");
  }
  const data = new TextEncoder().encode(command);
  if (typeof controlCharacteristic.writeValueWithResponse === "function") {
    await controlCharacteristic.writeValueWithResponse(data);
  } else {
    await controlCharacteristic.writeValue(data);
  }
}

function startDemo() {
  if (isDemoActive()) {
    stopDemo();
    return;
  }

  if (isBluetoothConnected()) {
    bluetoothDevice.gatt.disconnect();
  }

  clearMessage();
  demoStartedAt = performance.now();
  demoLastTickAt = demoStartedAt;
  demoPhase = 0;
  demoIntervalId = window.setInterval(generateDemoSample, 50);
  elements.demoButton.textContent = "Demo-Modus stoppen";
  setDemoStatus(`${demoProfileLabel(elements.demoProfile.value)} aktiv`, "demo");
  renderAll();
}

function stopDemo() {
  if (!isDemoActive()) return;

  if (recording && !isBluetoothConnected()) {
    stopRecording(false);
  }

  window.clearInterval(demoIntervalId);
  demoIntervalId = null;
  elements.demoButton.textContent = "Demo-Modus starten";
  setDemoStatus("Demo aus", "offline");
  renderAll();
}

function generateDemoSample() {
  const now = performance.now();
  const elapsedMs = now - demoStartedAt;
  const elapsedSeconds = elapsedMs / 1000;
  const recordingElapsedSeconds = recording && demoRecordingStartedAt
    ? (now - demoRecordingStartedAt) / 1000
    : elapsedSeconds;
  const deltaSeconds = Math.max(0.001, (now - demoLastTickAt) / 1000);
  demoLastTickAt = now;
  const profile = elements.demoProfile.value;
  const exercise = getSelectedExercise();
  const mode = normalizeAnalysisMode(exercise?.analysisMode, exercise?.equipmentType);

  let period = 1.8;
  let amplitude = 0.68;
  let noiseLevel = 0.018;
  if (profile === "fast") period = 0.95;
  if (profile === "short") amplitude = 0.34;
  if (profile === "jerky") noiseLevel = 0.065;
  if (profile === "fatigue") {
    const fatigue = clamp(recordingElapsedSeconds / 18, 0, 1);
    period = 1.8 + fatigue * 0.55;
    amplitude = 0.68 * (1 - fatigue * 0.48);
    noiseLevel = 0.018 + fatigue * 0.055;
  }

  demoPhase = (demoPhase + deltaSeconds / period) % 1;
  const phase = demoPhase;
  const targetReps = 8;
  const demoSetFinished = recording && recordingElapsedSeconds > period * targetReps + 0.75;
  const activeFraction = 0.6;
  const activePhase = phase / activeFraction;
  const inRestDwell = phase >= activeFraction;
  const smoothPulse = demoSetFinished || inRestDwell ? 0 : Math.sin(Math.PI * activePhase) ** 2;
  const velocity = demoSetFinished || inRestDwell ? 0 : Math.sin(2 * Math.PI * activePhase);
  const direction = demoSetFinished || inRestDwell ? 0 : Math.cos(2 * Math.PI * activePhase);
  const gaussian = (center, width) => Math.exp(-((phase - center) ** 2) / width);
  const jerk = profile === "jerky"
    ? 0.38 * gaussian(0.22, 0.0009) - 0.28 * gaussian(0.68, 0.0014)
    : 0;
  const randomNoise = () => (Math.random() - 0.5) * 2 * noiseLevel;

  let ax = 0.08 * direction + jerk * 0.32 + randomNoise();
  let ay = 0.05 * velocity + jerk * 0.18 + randomNoise();
  let az = 1 + amplitude * smoothPulse + jerk + randomNoise();
  let gyroScale = profile === "short" ? 18 : profile === "fast" ? 43 : 30;
  if (mode === "weight_stack") {
    ax = 0.02 * direction + randomNoise() * 0.55;
    ay = 0.015 * velocity + randomNoise() * 0.55;
    az = 1 + amplitude * smoothPulse + jerk + randomNoise();
    gyroScale = profile === "clean" ? 1.4 : profile === "jerky" ? 18 : 7;
  }
  const gx = gyroScale * velocity + jerk * (mode === "weight_stack" ? 18 : 95) + randomNoise() * (mode === "weight_stack" ? 2 : 20);
  const gy = gyroScale * 0.35 * direction + randomNoise() * (mode === "weight_stack" ? 2 : 18);
  const gz = gyroScale * 0.18 * velocity + jerk * (mode === "weight_stack" ? 12 : 55) + randomNoise() * (mode === "weight_stack" ? 2 : 18);
  const distanceMm = mode === "weight_stack"
    ? Math.max(80, 760 - smoothPulse * amplitude * 210 + randomNoise() * 8)
    : null;
  const line = mode === "weight_stack"
    ? [Math.round(elapsedMs), ax, ay, az, gx, gy, gz, distanceMm].join(",")
    : [Math.round(elapsedMs), ax, ay, az, gx, gy, gz].join(",");

  processDataLine(line, "Demo");
}

function demoProfileLabel(profile) {
  return {
    clean: "Saubere Referenz",
    fast: "Zu schnell",
    short: "Verkürzte Amplitude",
    jerky: "Ruckartige Bewegung",
    fatigue: "Ermüdung",
  }[profile] || "Demo";
}

// ---------------------------------------------------------------------------
// Datenparser und Aufnahme
// ---------------------------------------------------------------------------

function isValidDataLine(line) {
  if (!line) return false;
  const parts = line.trim().split(",");
  if (parts.length !== 7 && parts.length !== 8) return false;
  return parts.every((part) => part.trim() !== "" && Number.isFinite(Number(part)));
}

function parseDataLine(line) {
  if (!isValidDataLine(line)) return null;
  const parts = line.trim().split(",");
  const values = parts.map(Number);
  const [timestamp, ax, ay, az, gx, gy, gz, distanceMmRaw] = values;
  if (timestamp < 0) return null;
  const hasUltrasound = parts.length === 8;
  const distanceMm = hasUltrasound && Number.isFinite(distanceMmRaw) && distanceMmRaw > 0
    ? distanceMmRaw
    : null;
  return {
    timestamp,
    ax,
    ay,
    az,
    gx,
    gy,
    gz,
    distanceMm,
    ultrasoundMm: distanceMm,
    hasUltrasound,
    ultrasoundValid: distanceMm !== null,
    accMagnitude: Math.hypot(ax, ay, az),
    gyroMagnitude: Math.hypot(gx, gy, gz),
  };
}

function processDataLine(line, source) {
  const sample = parseDataLine(line);
  if (!sample) return;

  updateCurrentValues(sample);
  if (calibrationActive) {
    calibrationSamples.push(sample);
  }
  if (!recording) return;

  samples.push(sample);
  elements.sampleCount.textContent = String(samples.length);
  if (elements.debugSampleCount) elements.debugSampleCount.textContent = String(samples.length);

  if (samples.length % 8 === 0 || samples.length < 10) {
    liveAnalysis = analyzeRecordingByMode(samples, getSelectedExercise());
    elements.liveRepCount.textContent = String(liveAnalysis.reps);
    updateLiveTrainingValues(liveAnalysis);
    queueLiveRepAudio(liveAnalysis);
  }
  if (samples.length % 3 === 0 || samples.length < 5) {
    drawCharts();
  }
}

async function startRecording(mode = "set") {
  clearMessage();
  const exercise = getSelectedExercise();
  if (!exercise) {
    showMessage("Wähle zuerst eine Übung aus.");
    switchTab("exercises");
    return;
  }
  if (!hasDataSource()) {
    showMessage("Keine Datenquelle. Verbinde GymIMU oder starte den Demo-Modus.");
    return;
  }
  if (recording) return;

  try {
    if (isBluetoothConnected()) {
      await writeControlCommand("START\n");
    }
    samples = [];
    pendingRecording = null;
    recording = true;
    recordingMode = mode === "reference" ? "reference" : "set";
    recordingStartedAt = Date.now();
    if (isDemoActive()) {
      demoRecordingStartedAt = performance.now();
      demoPhase = 0;
    }
    recordedDurationMs = 0;
    liveAnalysis = emptyMetrics();
    lastAudioRepCount = 0;
    cleanRepOptionalSpoken = false;
    audioEventCounts = {};
    recordingTimerId = window.setInterval(updateRecordingTime, 100);
    elements.recordingPreview.hidden = true;
    elements.subjectiveSetPanel.hidden = true;
    elements.setRpe.value = "";
    elements.setRir.value = "";
    elements.setNote.value = "";
    renderRecordingState();
    drawCharts();
  } catch (error) {
    showMessage(`Aufnahme konnte nicht gestartet werden: ${friendlyError(error)}`);
  }
}

async function stopRecording(sendCommand = true) {
  if (!recording) return;

  recordedDurationMs = Date.now() - recordingStartedAt;
  recording = false;
  demoRecordingStartedAt = 0;
  window.clearInterval(recordingTimerId);
  recordingTimerId = null;

  if (sendCommand && isBluetoothConnected()) {
    try {
      await writeControlCommand("STOP\n");
    } catch (error) {
      showMessage(`Aufnahme beendet, STOP konnte aber nicht gesendet werden: ${friendlyError(error)}`);
    }
  }

  const exercise = getSelectedExercise();
  liveAnalysis = analyzeRecordingByMode(samples, exercise);
  const type = recordingMode || "set";
  pendingRecording = {
    id: createId(),
    type,
    name: type === "reference" ? "Referenz" : `Satz ${(exercise?.setRecordings.length || 0) + 1}`,
    createdAt: new Date().toISOString(),
    durationMs: liveAnalysis.durationMs || recordedDurationMs,
    sampleCount: samples.length,
    rawSamples: samples.map(copySample),
    metrics: liveAnalysis,
    comparison: null,
    subjective: normalizeSubjectiveSet(null),
    session: { date: new Date().toISOString() },
  };

  if (type === "set" && exercise?.referenceRecording) {
    pendingRecording.comparison = compareRecordingToReference(
      pendingRecording,
      exercise.referenceRecording,
      exercise,
    );
    pendingRecording.metrics.movementQualityScore = pendingRecording.comparison.overallScore;
  }
  if (type === "set") {
    queueAudioCue({
      type: "set_summary",
      message: buildSetSummaryAudio(pendingRecording.metrics),
      priority: 10,
    });
  }

  renderRecordingState();
  renderRecordingPreview();
  drawCharts();
}

function discardRecording() {
  if (recording) {
    showMessage("Stoppe die Aufnahme, bevor du sie verwirfst.");
    return;
  }
  samples = [];
  pendingRecording = null;
  recordingMode = null;
  demoRecordingStartedAt = 0;
  recordedDurationMs = 0;
  liveAnalysis = emptyMetrics();
  resetLiveDisplay();
  elements.subjectiveSetPanel.hidden = true;
  elements.setRpe.value = "";
  elements.setRir.value = "";
  elements.setNote.value = "";
  renderRecordingState();
  drawCharts();
}

async function startCalibration() {
  clearMessage();
  const exercise = getSelectedExercise();
  if (!exercise) {
    showMessage("Wähle zuerst eine Übung aus.");
    return;
  }
  if (!hasDataSource()) {
    showMessage("Keine Datenquelle. Verbinde GymIMU oder starte den Demo-Modus.");
    return;
  }
  if (recording) {
    showMessage("Kalibriere den Sensor vor oder nach einer Aufnahme.");
    return;
  }
  if (calibrationActive) return;

  calibrationActive = true;
  calibrationSamples = [];
  elements.calibrateButton.disabled = true;
  elements.calibrateButton.textContent = "3 s ruhig halten ...";
  showMessage("Sensor ruhig halten. Kalibrierung läuft 3 Sekunden.", "info");
  if (isBluetoothConnected()) {
    try {
      await writeControlCommand("START\n");
    } catch (error) {
      calibrationActive = false;
      elements.calibrateButton.textContent = "Sensor kalibrieren";
      renderRecordingState();
      showMessage(`Kalibrierung konnte nicht gestartet werden: ${friendlyError(error)}`);
      return;
    }
  }

  window.clearTimeout(calibrationTimerId);
  calibrationTimerId = window.setTimeout(async () => {
    if (isBluetoothConnected()) {
      try {
        await writeControlCommand("STOP\n");
      } catch (error) {
        showMessage(`Kalibrierung beendet, STOP konnte aber nicht gesendet werden: ${friendlyError(error)}`, "info", true);
      }
    }
    calibrationActive = false;
    const profile = calibrateSensor(calibrationSamples);
    if (!profile) {
      elements.calibrateButton.textContent = "Sensor kalibrieren";
      renderRecordingState();
      showMessage("Zu wenige Samples für die Kalibrierung empfangen.");
      return;
    }
    exercise.calibrationProfile = profile;
    saveState();
    elements.calibrateButton.textContent = "Sensor kalibrieren";
    showMessage("Kalibrierung gespeichert.", "success");
    renderAll();
  }, 3000);
}

function saveRecording() {
  if (!pendingRecording) {
    showMessage("Es gibt keine abgeschlossene Aufnahme zum Speichern.");
    return;
  }
  const exercise = getSelectedExercise();
  if (!exercise) {
    showMessage("Die zugehörige Übung wurde nicht gefunden.");
    return;
  }

  if (pendingRecording.type === "reference") {
    saveReference();
    return;
  }

  pendingRecording.subjective = readSubjectiveSetInputs();
  pendingRecording.session = {
    date: new Date().toISOString(),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    weight: exercise.weight,
    targetReps: exercise.targetReps,
    setType: exercise.setType,
  };

  if (exercise.referenceRecording) {
    pendingRecording.comparison = compareRecordingToReference(
      pendingRecording,
      exercise.referenceRecording,
      exercise,
    );
    pendingRecording.metrics.movementQualityScore = pendingRecording.comparison.overallScore;
  } else {
    pendingRecording.metrics.movementQualityScore = Math.round(
      (pendingRecording.metrics.smoothnessScore + pendingRecording.metrics.tempoConsistencyScore) / 2,
    );
    pendingRecording.comparison = {
      overallScore: null,
      feedbackMessages: ["Keine Referenz vorhanden. Der Satz wurde ohne Referenzvergleich gespeichert."],
      feedbackEvents: buildFeedbackEvents(pendingRecording.metrics, null),
    };
  }

  exercise.setRecordings.push(pendingRecording);
  addSetToSession(exercise, pendingRecording);
  saveState();
  showMessage(`${pendingRecording.name} wurde gespeichert.`, "success");
  const savedId = pendingRecording.id;
  pendingRecording = null;
  recordingMode = null;
  elements.subjectiveSetPanel.hidden = true;
  elements.setRpe.value = "";
  elements.setRir.value = "";
  elements.setNote.value = "";
  selectedAnalysisRecordingIds.add(savedId);
  renderAll();
}

function saveReference() {
  const exercise = getSelectedExercise();
  if (!exercise || !pendingRecording || pendingRecording.type !== "reference") {
    showMessage("Es liegt keine Referenzaufnahme zum Speichern vor.");
    return;
  }
  if (
    exercise.referenceRecording &&
    !window.confirm("Die vorhandene Referenz dieser Übung ersetzen?")
  ) {
    return;
  }

  pendingRecording.name = "Referenz";
  pendingRecording.metrics = analyzeRecordingByMode(pendingRecording.rawSamples, exercise);
  pendingRecording.metrics.referenceQuality = assessReferenceQuality(pendingRecording.metrics);
  if (pendingRecording.metrics.referenceQuality.status !== "good") {
    const issues = pendingRecording.metrics.referenceQuality.issues.join(", ");
    speakFeedback("Referenz ungeeignet, bitte neu aufnehmen.");
    if (!window.confirm(`Referenz ungeeignet: ${issues}. Trotzdem als Referenz speichern?`)) {
      showMessage(`Referenz ungeeignet. Bitte neu aufnehmen: ${issues}`, "error", true);
      return;
    }
  }
  pendingRecording.metrics.movementQualityScore = Math.round(
    (pendingRecording.metrics.smoothnessScore + pendingRecording.metrics.tempoConsistencyScore) / 2,
  );
  exercise.referenceRecording = pendingRecording;
  if (pendingRecording.metrics.referenceQuality.status !== "good") {
    showMessage(`Referenz ungleichmäßig, bitte ggf. neu aufnehmen: ${pendingRecording.metrics.referenceQuality.issues.join(", ")}`, "info", true);
  }

  // Bestehende Sätze werden mit der neuen Referenz neu bewertet.
  exercise.setRecordings.forEach((setRecording) => {
    setRecording.metrics = analyzeRecordingByMode(setRecording.rawSamples, exercise);
    setRecording.comparison = compareRecordingToReference(setRecording, pendingRecording, exercise);
    setRecording.metrics.movementQualityScore = setRecording.comparison.overallScore;
  });

  selectedAnalysisRecordingIds.add(pendingRecording.id);
  saveState();
  pendingRecording = null;
  recordingMode = null;
  showMessage("Referenz für diese Übung gespeichert.", "success");
  speakFeedback("Referenz gespeichert.");
  renderAll();
}

function compareWithReference() {
  const exercise = getSelectedExercise();
  const current = pendingRecording || (
    samples.length
      ? {
          rawSamples: samples,
          metrics: analyzeRecordingByMode(samples, exercise),
          durationMs: getSampleDuration(samples),
        }
      : null
  );
  if (!exercise?.referenceRecording || !current) return null;
  return compareRecordingToReference(current, exercise.referenceRecording, exercise);
}

function copySample(sample) {
  return {
    timestamp: sample.timestamp,
    ax: sample.ax,
    ay: sample.ay,
    az: sample.az,
    gx: sample.gx,
    gy: sample.gy,
    gz: sample.gz,
    distanceMm: sample.distanceMm ?? null,
    ultrasoundMm: sample.ultrasoundMm ?? sample.distanceMm ?? null,
    hasUltrasound: Boolean(sample.hasUltrasound),
    ultrasoundValid: sample.ultrasoundValid === true || Number.isFinite(Number(sample.distanceMm)),
    accMagnitude: sample.accMagnitude,
    gyroMagnitude: sample.gyroMagnitude,
  };
}

function normalizeWeightStackInputSamples(inputSamples, options = {}) {
  const optionsUsed = mergeWeightStackOptions(options);
  return inputSamples.map((sample, index) => {
    const accel = normalizeMpuSample(sample, index, optionsUsed);
    if (!accel) return null;
    const timestamp = firstFinite(accel.timestamp, index * 20);
    const gx = firstFinite(accel.gxDps, 0);
    const gy = firstFinite(accel.gyDps, 0);
    const gz = firstFinite(accel.gzDps, 0);
    return {
      timestamp,
      ax: accel.axG,
      ay: accel.ayG,
      az: accel.azG,
      gx,
      gy,
      gz,
      accMagnitude: Math.hypot(accel.axG, accel.ayG, accel.azG),
      gyroMagnitude: Math.hypot(gx, gy, gz),
      distanceMm: accel.distanceMm,
      ultrasoundMm: accel.ultrasoundMm,
      hasUltrasound: accel.hasUltrasound,
      ultrasoundValid: accel.ultrasoundValid,
      rawPrimary: accel.axG,
      has3d: accel.has3d,
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Analyse, Rep-Erkennung und Referenzvergleich
// ---------------------------------------------------------------------------
// Gemeinsame Analyse-Helfer
// ---------------------------------------------------------------------------

function errorToScore(error) {
  return clamp(100 * Math.exp(-Math.max(0, error) * 0.9), 0, 100);
}

function percentSimilarity(current, reference) {
  if (reference === 0) return current === 0 ? 100 : 0;
  return clamp(100 * (1 - Math.abs(current - reference) / Math.abs(reference)), 0, 100);
}

function percentDifference(current, reference) {
  if (!reference) return current ? 100 : 0;
  return ((current - reference) / Math.abs(reference)) * 100;
}

function comparisonSafePercentDifference(current, reference) {
  const currentValue = Number(current) || 0;
  const referenceValue = Number(reference) || 0;
  if (Math.abs(referenceValue) < 0.05) return Math.max(0, currentValue - referenceValue) * 100;
  return percentDifference(currentValue, referenceValue);
}

function estimateSampleInterval(data) {
  if (data.length < 2) return 50;
  const intervals = [];
  for (let index = 1; index < Math.min(data.length, 101); index += 1) {
    const interval = data[index].timestamp - data[index - 1].timestamp;
    if (interval > 0 && interval < 1000) intervals.push(interval);
  }
  return intervals.length ? percentile(intervals, 0.5) : 50;
}

function getSampleDuration(data) {
  if (!data || data.length < 2) return recordedDurationMs;
  return Math.max(0, data[data.length - 1].timestamp - data[0].timestamp);
}

function percentile(values, fraction) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return 0;
  const position = clamp(fraction, 0, 1) * (valid.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return valid[lower];
  const weight = position - lower;
  return valid[lower] * (1 - weight) + valid[upper] * weight;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function mean(values) {
  return average(values);
}

function variance(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  const center = mean(valid);
  return mean(valid.map((value) => (value - center) ** 2));
}

function std(values) {
  return Math.sqrt(variance(values));
}

function dot(a, b) {
  return (Number(a?.[0]) || 0) * (Number(b?.[0]) || 0) +
    (Number(a?.[1]) || 0) * (Number(b?.[1]) || 0) +
    (Number(a?.[2]) || 0) * (Number(b?.[2]) || 0);
}

function normalizeVec(vector) {
  const x = Number(vector?.[0]) || 0;
  const y = Number(vector?.[1]) || 0;
  const z = Number(vector?.[2]) || 0;
  const length = Math.hypot(x, y, z);
  return length > 0.000001 ? [x / length, y / length, z / length] : [0, 0, 1];
}

function estimateSampleRate(timestamps = []) {
  const intervalMs = estimateIntervalFromTimestamps(timestamps);
  return intervalMs ? 1000 / intervalMs : 0;
}

function getMpuLsbPerG(options = {}) {
  if (hasNumericWeightStackOption(options.lsbPerG)) return Number(options.lsbPerG);
  return {
    2: 16384,
    4: 8192,
    8: 4096,
    16: 2048,
  }[Number(options.mpuAccelRangeG) || 4] || 8192;
}

function convertAccelerationToG(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  if (options.accUnit === "raw_mpu6050") return number / getMpuLsbPerG(options);
  if (options.accUnit === "mps2") return number / 9.80665;
  return number;
}

function normalizeMpuSample(sample, index = 0, options = {}) {
  const timestamp = firstFinite(sample?.timestamp, sample?.time, sample?.t, NaN);
  const raw = sample;
  const distanceCandidate = firstFinite(sample?.distanceMm, sample?.ultrasoundMm, NaN);
  const distanceMm = Number.isFinite(distanceCandidate) && distanceCandidate > 0 ? distanceCandidate : null;

  if (Array.isArray(sample)) {
    const axG = convertAccelerationToG(sample[0], options);
    const ayG = convertAccelerationToG(sample[1], options);
    const azG = convertAccelerationToG(sample[2], options);
    if ([axG, ayG, azG].every(Number.isFinite)) {
      return { timestamp, axG, ayG, azG, gxDps: 0, gyDps: 0, gzDps: 0, has3d: true, hasGyro: false, distanceMm: null, ultrasoundMm: null, hasUltrasound: false, ultrasoundValid: false, raw };
    }
    const valueG = convertAccelerationToG(sample[0], options);
    return Number.isFinite(valueG)
      ? { timestamp, axG: valueG, ayG: 0, azG: 0, gxDps: 0, gyDps: 0, gzDps: 0, has3d: false, hasGyro: false, distanceMm: null, ultrasoundMm: null, hasUltrasound: false, ultrasoundValid: false, raw }
      : null;
  }

  if (Number.isFinite(Number(sample))) {
    const valueG = convertAccelerationToG(sample, options);
    return { timestamp, axG: valueG, ayG: 0, azG: 0, gxDps: 0, gyDps: 0, gzDps: 0, has3d: false, hasGyro: false, distanceMm: null, ultrasoundMm: null, hasUltrasound: false, ultrasoundValid: false, raw };
  }

  if (!sample || typeof sample !== "object") return null;

  const axG = convertAccelerationToG(firstFinite(sample.ax, sample.accelX, sample.x), options);
  const ayG = convertAccelerationToG(firstFinite(sample.ay, sample.accelY, sample.y), options);
  const azG = convertAccelerationToG(firstFinite(sample.az, sample.accelZ, sample.z), options);
  const gxDps = firstFinite(sample.gx, sample.gyroX, sample.rx, 0);
  const gyDps = firstFinite(sample.gy, sample.gyroY, sample.ry, 0);
  const gzDps = firstFinite(sample.gz, sample.gyroZ, sample.rz, 0);
  const hasGyro = [gxDps, gyDps, gzDps].some((value) => Number.isFinite(value) && Math.abs(value) > 0);

  if ([axG, ayG, azG].every(Number.isFinite)) {
    return { timestamp, axG, ayG, azG, gxDps, gyDps, gzDps, has3d: true, hasGyro, distanceMm, ultrasoundMm: distanceMm, hasUltrasound: Boolean(sample.hasUltrasound) || "distanceMm" in sample || "ultrasoundMm" in sample, ultrasoundValid: distanceMm !== null, raw };
  }

  const valueG = convertAccelerationToG(firstFinite(sample.rawPrimary, sample.value, sample.acc, sample.accMagnitude, sample.magnitude), options);
  if (Number.isFinite(valueG)) {
    return { timestamp, axG: valueG, ayG: 0, azG: 0, gxDps, gyDps, gzDps, has3d: false, hasGyro, distanceMm, ultrasoundMm: distanceMm, hasUltrasound: Boolean(sample.hasUltrasound) || "distanceMm" in sample || "ultrasoundMm" in sample, ultrasoundValid: distanceMm !== null, raw };
  }
  return null;
}

function extractAccelSample(sample) {
  const normalized = normalizeMpuSample(sample, 0, { accUnit: "g" });
  return normalized
    ? {
        ax: normalized.axG,
        ay: normalized.ayG,
        az: normalized.azG,
        value: normalized.axG,
        has3d: normalized.has3d,
      }
    : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return NaN;
}

function lowPassIIR(values, timestamps, cutoffHz = 6) {
  if (!values.length) return [];
  const filtered = [Number(values[0]) || 0];
  for (let index = 1; index < values.length; index += 1) {
    const dt = Math.max((timestamps[index] - timestamps[index - 1]) / 1000, 0.001);
    const rc = 1 / (2 * Math.PI * Math.max(0.1, cutoffHz));
    const alpha = dt / (rc + dt);
    filtered[index] = filtered[index - 1] + alpha * ((Number(values[index]) || 0) - filtered[index - 1]);
  }
  return filtered;
}
function emptyMetrics() {
  return {
    analysisMode: "free_movement",
    modeLabel: "Freie Bewegung",
    reps: 0,
    durationMs: 0,
    avgRepDurationMs: 0,
    avgAccMagnitude: 0,
    maxAccMagnitude: 0,
    avgGyroMagnitude: 0,
    maxGyroMagnitude: 0,
    dominantAxis: "az",
    amplitudeEstimate: 0,
    ROMProxy: 0,
    relativeRangeOfMotion: null,
    smoothnessScore: 0,
    tempoConsistencyScore: 0,
    stabilityScore: 0,
    gyroStabilityScore: 0,
    tremorScore: 0,
    movementQualityScore: 0,
    cleanRepCount: 0,
    warningRepCount: 0,
    badRepCount: 0,
    uncertainRepCount: 0,
    firstBadRep: null,
    mainIssue: "—",
    velocityLossPercent: 0,
    recommendation: {
      action: "technique_focus",
      label: "Technikfokus",
      message: "Noch keine belastbare Trainingsaussage.",
      reasons: [],
    },
    sensorQuality: {
      status: "uncertain",
      issues: [],
      sampleRateHz: 0,
    },
    referenceQuality: null,
    repTimestamps: [],
    repSegments: [],
    repMetrics: [],
    repAmplitudes: [],
    fatigue: {
      fatigueDetected: false,
      fatigueStartRep: null,
      fatigueReasons: [],
      fatigueScore: 0,
    },
    feedbackEvents: [],
    signals: {
      primary: [],
      secondary: [],
      timestamps: [],
      primaryLabel: "Bewegungssignal",
      secondaryLabel: "Gyro-Magnitude",
    },
  };
}

function analyzeRecording(inputSamples) {
  return analyzeRecordingByMode(inputSamples, getSelectedExercise());
}

function analyzeRecordingByMode(recordingData, exercise = null) {
  const inputSamples = Array.isArray(recordingData) ? recordingData : recordingData?.rawSamples;
  if (!Array.isArray(inputSamples) || inputSamples.length === 0) return emptyMetrics();
  const mode = normalizeAnalysisMode(exercise?.analysisMode, exercise?.equipmentType);
  if (mode === "weight_stack") {
    const normalizedWeightStackSamples = normalizeWeightStackInputSamples(inputSamples, exercise?.weightStackOptions || {});
    if (!normalizedWeightStackSamples.length) return emptyMetrics();
    return analyzeWeightStack(normalizedWeightStackSamples, exercise);
  }
  const cleanSamples = inputSamples.filter((sample) =>
    ["timestamp", "ax", "ay", "az", "gx", "gy", "gz"].every((key) => Number.isFinite(Number(sample[key]))),
  );
  if (!cleanSamples.length) return emptyMetrics();
  if (mode === "barbell") return analyzeBarbell(cleanSamples, exercise);
  if (mode === "cable_handle") return analyzeCableHandle(cleanSamples, exercise);
  if (mode === "body_segment") {
    const result = analyzeFreeMovement(cleanSamples, { ...exercise, analysisMode: "body_segment" });
    result.modeLabel = "Körpersegment (Future Mode)";
    result.feedbackEvents.push({ type: "future_mode", rep: null });
    return result;
  }
  return analyzeFreeMovement(cleanSamples, exercise);
}

function analyzeWeightStack(inputSamples, exercise) {
  return analyzeMode(inputSamples, exercise, {
    mode: "weight_stack",
    modeLabel: "Gewichtsblock / geführte Maschine",
    primaryLabel: "Bewegungssignal",
    secondaryLabel: "Gyro / Debug",
    gyroPenalty: 0,
    stabilityWeight: 0,
    weightStackOptions: exercise?.weightStackOptions || {},
  });
}

function analyzeBarbell(inputSamples, exercise) {
  return analyzeMode(inputSamples, exercise, {
    mode: "barbell",
    modeLabel: "Langhantel / Stangenachse",
    primaryLabel: "Bar Movement Proxy",
    secondaryLabel: "Tilt-/Rotation-Proxy",
    gyroPenalty: 0.85,
    stabilityWeight: 0.24,
  });
}

function analyzeCableHandle(inputSamples, exercise) {
  return analyzeMode(inputSamples, exercise, {
    mode: "cable_handle",
    modeLabel: "Griff / Kabelzug",
    primaryLabel: "Dominante Acc-Kurve",
    secondaryLabel: "GyroMagnitude / Griffrotation",
    gyroPenalty: 0.95,
    stabilityWeight: 0.22,
  });
}

function analyzeFreeMovement(inputSamples, exercise) {
  return analyzeMode(inputSamples, exercise, {
    mode: normalizeAnalysisMode(exercise?.analysisMode) === "body_segment" ? "body_segment" : "free_movement",
    modeLabel: "Freie Bewegung",
    primaryLabel: "Generisches Bewegungssignal",
    secondaryLabel: "GyroMagnitude",
    gyroPenalty: 0.95,
    stabilityWeight: 0.16,
  });
}

function analyzeMode(inputSamples, exercise, config) {
  const prepared = prepareModeSignals(inputSamples, exercise, config);
  const sensorQuality = validateSampleRate(prepared.samples, config.mode);

  const repMarkers = config.mode === "weight_stack"
    ? detectWeightStackRepsIMU(prepared.samples ?? inputSamples, prepared.timestamps, {
        ...(config.weightStackOptions ?? {}),
      })
    : detectRepsCycleBased(prepared.filteredPrimary, prepared.timestamps, {
        minimumRepDurationMs: 700,
        minimumRestMs: 120,
      });

  const weightStackDebug = config.mode === "weight_stack" ? getWeightStackRepDebug() : null;
  if (config.mode === "weight_stack" && weightStackDebug?.restInfo?.restQuality && weightStackDebug.restInfo.restQuality !== "good") {
    sensorQuality.status = sensorQuality.status === "good" ? "warning" : sensorQuality.status;
    sensorQuality.issues.push(`Rest calibration ${weightStackDebug.restInfo.restQuality}`);
  }

  const primarySignal =
    config.mode === "weight_stack" &&
    weightStackDebug?.arrays?.positionProxy?.length === prepared.filteredPrimary.length
      ? weightStackDebug.arrays.positionProxy
      : config.mode === "weight_stack" &&
          weightStackDebug?.arrays?.filteredAccG?.length === prepared.filteredPrimary.length
        ? weightStackDebug.arrays.filteredAccG
        : prepared.filteredPrimary;

  const secondarySignal =
    config.mode === "weight_stack" &&
    weightStackDebug?.arrays?.velocityProxy?.length === prepared.secondary.length
      ? weightStackDebug.arrays.velocityProxy
      : prepared.secondary;

  const repSegments = segmentReps(prepared.samples, repMarkers).map((segment) => ({
    ...segment,
    primary: primarySignal.slice(segment.startIndex, segment.endIndex + 1),
    highFrequency: prepared.highFrequency.slice(segment.startIndex, segment.endIndex + 1),
    gyroMagnitude: prepared.gyroMagnitude.slice(segment.startIndex, segment.endIndex + 1),
    secondary: secondarySignal.slice(segment.startIndex, segment.endIndex + 1),
    jerk: prepared.jerk.slice(segment.startIndex, Math.max(segment.startIndex, segment.endIndex)),
  }));

  const repMetrics = calculateRepMetrics(repSegments, config.mode);
  const referenceRepMetrics = exercise?.referenceRecording?.metrics?.repMetrics || [];
  applyVelocityLoss(repMetrics);
  applyRomRelativeToReference(repMetrics, referenceRepMetrics);
  const qualitySummary = classifyCleanReps(repMetrics, referenceRepMetrics, config.mode, sensorQuality);
  const fatigue = detectFatigue(repMetrics, exercise?.referenceRecording?.metrics?.repMetrics || [], config.mode);
  applyRepFeedback(repMetrics, fatigue, config.mode);
  const repDurations = repMetrics.map((rep) => rep.durationMs).filter((value) => value > 0);
  const repAmplitudes = repMetrics.map((rep) => rep.amplitudeProxy);
  const smoothnessScore = Math.round(clamp(average(repMetrics.map((rep) => rep.smoothnessScore)), 0, 100));
  const gyroStabilityScore = Math.round(clamp(average(repMetrics.map((rep) => rep.gyroStabilityScore)), 0, 100));
  const stabilityScore = config.mode === "barbell"
    ? Math.round(clamp(average(repMetrics.map((rep) => rep.barTiltScore)), 0, 100))
    : gyroStabilityScore;
  const tremorScore = average(repMetrics.map((rep) => rep.tremorScore));
  const tempoConsistencyScore = repDurations.length >= 2
    ? Math.round(clamp(100 - (standardDeviation(repDurations) / Math.max(average(repDurations), 1)) * 240, 0, 100))
    : repDurations.length === 1 ? 55 : 0;
  const amplitudeEstimate = repAmplitudes.length
  ? average(repAmplitudes)
  : Math.max(0, percentile(primarySignal, 0.95) - percentile(primarySignal, 0.05));
  const movementQualityScore = config.mode === "weight_stack"
    ? calculateWeightStackScore({
        repMetrics,
        referenceRepMetrics,
        tempoConsistencyScore,
        tremorScore,
      })
    : Math.round(clamp(
        smoothnessScore * 0.34 +
        tempoConsistencyScore * 0.18 +
        stabilityScore * config.stabilityWeight +
        clamp(100 - tremorScore * 18, 0, 100) * 0.18 +
        (100 - fatigue.fatigueScore) * 0.08,
        0,
        100,
      ));
  const preliminaryAnalysis = {
    ...emptyMetrics(),
    reps: repMetrics.length,
    cleanRepCount: qualitySummary.clean,
    warningRepCount: qualitySummary.warning,
    badRepCount: qualitySummary.bad,
    uncertainRepCount: qualitySummary.uncertain,
    firstBadRep: qualitySummary.firstBadRep,
    mainIssue: qualitySummary.mainIssue,
    velocityLossPercent: qualitySummary.velocityLossPercent,
    fatigue,
    sensorQuality,
  };
  const recommendation = generateTrainingRecommendation(preliminaryAnalysis, null, exercise);

  return {
    ...emptyMetrics(),
    analysisMode: config.mode,
    modeLabel: config.modeLabel,
    reps: repMetrics.length,
    durationMs: getSampleDuration(prepared.samples),
    avgRepDurationMs: Math.round(average(repDurations)),
    avgAccMagnitude: average(prepared.accMagnitude),
    maxAccMagnitude: Math.max(...prepared.accMagnitude, 0),
    avgGyroMagnitude: average(prepared.gyroMagnitude),
    maxGyroMagnitude: Math.max(...prepared.gyroMagnitude, 0),
    dominantAxis: prepared.dominantAxis,
    amplitudeEstimate,
    ROMProxy: amplitudeEstimate,
    smoothnessScore,
    tempoConsistencyScore,
    stabilityScore,
    gyroStabilityScore,
    tremorScore,
    movementQualityScore,
    cleanRepCount: qualitySummary.clean,
    warningRepCount: qualitySummary.warning,
    badRepCount: qualitySummary.bad,
    uncertainRepCount: qualitySummary.uncertain,
    firstBadRep: qualitySummary.firstBadRep,
    mainIssue: qualitySummary.mainIssue,
    velocityLossPercent: qualitySummary.velocityLossPercent,
    recommendation,
    sensorQuality,
    repTimestamps: repMarkers.map((marker) => prepared.samples[marker.peakIndex]?.timestamp).filter(Number.isFinite),
    repSegments: repSegments.map(({ startIndex, peakIndex, endIndex, startTimestamp, peakTimestamp, endTimestamp }) => ({
      startIndex,
      peakIndex,
      endIndex,
      startTimestamp,
      peakTimestamp,
      endTimestamp,
    })),
    repMetrics,
    repAmplitudes,
    fatigue,
    feedbackEvents: buildFeedbackEvents({ repMetrics, fatigue, sensorQuality }, null),
    weightStackDebug,
    signals: {
      primary: primarySignal,
      secondary: secondarySignal,
      timestamps: prepared.timestamps,
      primaryLabel: config.mode === "weight_stack"
        ? (weightStackDebug?.ultrasound?.available ? "Ultraschall-ROM / Position-Proxy" : "ROM-/Position-Proxy")
        : config.primaryLabel,
      secondaryLabel: config.mode === "weight_stack" ? "Velocity-/Control-Proxy" : config.secondaryLabel,
},
  };
}

function prepareModeSignals(inputSamples, exercise, config) {
  const samplesWithBias = subtractBias(inputSamples, exercise?.calibrationProfile);
  const dominantAxis = determineDominantAxis(inputSamples, exercise?.calibrationProfile);
  const timestamps = samplesWithBias.map((sample) => sample.timestamp);
  const alpha = clamp((estimateSampleInterval(samplesWithBias) / 20) * 0.14, 0.12, 0.18);
  const rawPrimary = config.mode === "free_movement" || config.mode === "body_segment"
    ? samplesWithBias.map((sample) => Math.hypot(sample.ax, sample.ay, sample.az))
    : samplesWithBias.map((sample) => sample[dominantAxis]);
  const lowPassedPrimary = movingAverage(lowPassFilter(rawPrimary, alpha), 5);
  const baselineWindow = Math.max(9, Math.round(1200 / estimateIntervalFromTimestamps(timestamps)));
  const baseline = movingAverage(lowPassedPrimary, baselineWindow);
  const filteredPrimary = config.mode === "weight_stack"
    ? lowPassedPrimary.map((value, index) => value - baseline[index])
    : lowPassedPrimary;
  const gyroMagnitude = samplesWithBias.map((sample) => Math.hypot(sample.gx, sample.gy, sample.gz));
  return {
    samples: samplesWithBias,
    timestamps,
    dominantAxis,
    rawPrimary,
    lowPassedPrimary,
    baseline,
    filteredPrimary,
    highFrequency: highPassFromLowPass(rawPrimary, lowPassedPrimary),
    jerk: calculateJerk(filteredPrimary, timestamps),
    gyroMagnitude,
    accMagnitude: samplesWithBias.map((sample) => Math.hypot(sample.ax, sample.ay, sample.az)),
    secondary: config.mode === "barbell" ? estimateBarbellTiltProxy(samplesWithBias) : movingAverage(gyroMagnitude, 5),
  };
}

function calibrateSensor(inputSamples) {
  if (!Array.isArray(inputSamples) || inputSamples.length < 10) return null;
  const keys = ["ax", "ay", "az", "gx", "gy", "gz"];
  return {
    createdAt: new Date().toISOString(),
    sampleCount: inputSamples.length,
    bias: Object.fromEntries(keys.map((key) => [key, average(inputSamples.map((sample) => Number(sample[key]) || 0))])),
  };
}

function subtractBias(inputSamples, calibrationProfile) {
  const bias = calibrationProfile?.bias || {};
  return inputSamples.map((sample) => {
    const corrected = {
      timestamp: Number(sample.timestamp),
      ax: Number(sample.ax) - (Number(bias.ax) || 0),
      ay: Number(sample.ay) - (Number(bias.ay) || 0),
      az: Number(sample.az) - (Number(bias.az) || 0),
      gx: Number(sample.gx) - (Number(bias.gx) || 0),
      gy: Number(sample.gy) - (Number(bias.gy) || 0),
      gz: Number(sample.gz) - (Number(bias.gz) || 0),
    };
    corrected.accMagnitude = Math.hypot(corrected.ax, corrected.ay, corrected.az);
    corrected.gyroMagnitude = Math.hypot(corrected.gx, corrected.gy, corrected.gz);
    return corrected;
  });
}

function determineDominantAxis(inputSamples, calibrationProfile) {
  return ["ax", "ay", "az"]
    .map((axis) => ({ axis, spread: standardDeviation(subtractBias(inputSamples, calibrationProfile).map((sample) => sample[axis])) }))
    .sort((a, b) => b.spread - a.spread)[0]?.axis || "az";
}

function lowPassFilter(values, alpha = 0.15) {
  if (!values.length) return [];
  const result = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result[index] = result[index - 1] + alpha * (values[index] - result[index - 1]);
  }
  return result;
}

function movingAverage(values, windowSize) {
  const result = new Array(values.length);
  const half = Math.floor(Math.max(1, windowSize) / 2);
  const prefix = [0];
  values.forEach((value) => prefix.push(prefix[prefix.length - 1] + value));
  for (let index = 0; index < values.length; index += 1) {
    const start = Math.max(0, index - half);
    const end = Math.min(values.length - 1, index + half);
    result[index] = (prefix[end + 1] - prefix[start]) / (end - start + 1);
  }
  return result;
}

function highPassFromLowPass(raw, lowPassed) {
  return raw.map((value, index) => value - (lowPassed[index] || 0));
}

function rms(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? Math.sqrt(average(valid.map((value) => value ** 2))) : 0;
}

function calculateJerk(values, timestamps) {
  const result = [];
  for (let index = 1; index < values.length; index += 1) {
    const deltaSeconds = Math.max((timestamps[index] - timestamps[index - 1]) / 1000, 0.001);
    result.push((values[index] - values[index - 1]) / deltaSeconds);
  }
  return result;
}

function getWeightStackRepDebug() {
  return lastWeightStackRepDebug;
}

function mergeWeightStackOptions(options = {}) {
  const requestedProfile = options.exerciseKey || "default";
  const profile = options.enableExerciseProfiles === false
    ? {}
    : WEIGHT_STACK_EXERCISE_PROFILES[requestedProfile] || WEIGHT_STACK_EXERCISE_PROFILES.default;
  const merged = {
    ...defaultWeightStackOptions,
    ...profile,
    ...options,
    exerciseKey: requestedProfile,
  };
  if (hasNumericWeightStackOption(options.leak) && !hasNumericWeightStackOption(options.velocityLeak)) {
    merged.velocityLeak = Number(options.leak);
  }
  if (options.enableVelocityIntegration === false) merged.enableBoundedIntegration = false;
  if (options.enablePositionProxy === false) merged.enableBoundedIntegration = false;
  return merged;
}

function hasNumericWeightStackOption(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function detectWeightStackRepsIMU(samples, timestamps = [], options = {}) {
  const optionsUsed = mergeWeightStackOptions(options);
  const input = Array.isArray(samples) ? samples : [];
  const timestampInfo = resolveWeightStackTimestamps(input, timestamps);
  const resolvedTimestamps = timestampInfo.timestamps;
  const warnings = [...timestampInfo.warnings];
  const normalized = input.map((sample, index) => normalizeMpuSample(sample, index, optionsUsed));
  const validIndexes = normalized
    .map((sample, index) => sample ? index : -1)
    .filter((index) => index >= 0 && Number.isFinite(resolvedTimestamps[index]));

  if (validIndexes.length < 8) {
    warnings.push("Too few valid samples for weight-stack IMU detection.");
    lastWeightStackRepDebug = buildWeightStackDebug({
      mode: "axis_projection_bounded",
      warning: warnings.join(" "),
      warnings,
      optionsUsed,
      sampleCount: input.length,
      timestampCount: resolvedTimestamps.length,
      estimatedSampleRate: estimateSampleRate(resolvedTimestamps),
      reps: [],
      rejectedCandidates: [],
    });
    return [];
  }

  const imuSamples = validIndexes.map((index) => ({
    ...normalized[index],
    timestamp: resolvedTimestamps[index],
  }));
  const localTimestamps = imuSamples.map((sample) => sample.timestamp);
  const ultrasoundInfo = buildUltrasoundKinematics(imuSamples, localTimestamps, optionsUsed);
  const has3d = imuSamples.filter((sample) => sample.has3d).length / imuSamples.length >= 0.8;
  if (!has3d) warnings.push("Only 1D signal available; 3D IMU projection disabled.");

  const restInfo = calibrateWeightStackRest(imuSamples, localTimestamps, optionsUsed);
  warnings.push(...restInfo.warnings);

  const linearAccVectors = imuSamples.map((sample) => has3d
    ? [
        sample.axG - restInfo.gVec.x,
        sample.ayG - restInfo.gVec.y,
        sample.azG - restInfo.gVec.z,
      ]
    : [sample.axG - restInfo.oneDBias, 0, 0],
  );

  const axisInfo = has3d
    ? estimateMotionAxisPca(linearAccVectors, localTimestamps, restInfo.restEndIndex, optionsUsed)
    : {
        method: "fallback_1d",
        movementAxis: [1, 0, 0],
        dominantAxis: "ax",
        variance: { ax: variance(linearAccVectors.map((v) => v[0])), ay: 0, az: 0 },
        explainedRatio: 1,
      };

  let projectedAccG = projectOntoAxis(linearAccVectors, axisInfo.movementAxis);
  if (optionsUsed.useMagnitudeMinusGAsPrimary) {
    warnings.push("Using magnitude-minus-g as primary is diagnostic/fallback mode, not recommended for guided weight-stack counting.");
  }
  const magnitudeMinusG = imuSamples.map((sample) => Math.hypot(sample.axG, sample.ayG, sample.azG) - restInfo.gMagnitude);
  if (optionsUsed.useMagnitudeMinusGAsPrimary) projectedAccG = magnitudeMinusG.slice();

  const firstActiveIndex = findFirstActiveIndex(projectedAccG, restInfo.restEndIndex, optionsUsed.minActivityG);
  if (firstActiveIndex !== null && projectedAccG[firstActiveIndex] < 0) {
    projectedAccG = projectedAccG.map((value) => -value);
    axisInfo.movementAxis = axisInfo.movementAxis.map((value) => -value);
  }

  const filteredAccG = optionsUsed.enableLowPassFilter
    ? lowPassIIR(projectedAccG, localTimestamps, optionsUsed.cutoffHz)
    : projectedAccG.slice();

  const kinematics = ultrasoundInfo.available
    ? ultrasoundInfo.kinematics
    : integrateBoundedWeightStackMotion(filteredAccG, localTimestamps, restInfo, optionsUsed);
  kinematics.projectedAccG = projectedAccG;
  kinematics.filteredAccG = filteredAccG;
  kinematics.magnitudeMinusG = magnitudeMinusG;
  kinematics.movementAxis = axisInfo.movementAxis;
  kinematics.restInfo = restInfo;
  kinematics.warnings = warnings;
  kinematics.timestamps = localTimestamps;
  kinematics.ultrasound = ultrasoundInfo;

  const repResult = detectWeightStackRepsFromKinematics(kinematics, localTimestamps, optionsUsed);
  repResult.reps = splitMergedWeightStackReps(repResult.reps, kinematics, localTimestamps, optionsUsed);
  const enriched = enrichWeightStackRepMetrics(repResult.reps, kinematics, optionsUsed);
  const mappedReps = enriched.map((rep) => mapWeightStackRepIndexes(rep, validIndexes));

  lastWeightStackRepDebug = buildWeightStackDebug({
    mode: ultrasoundInfo.available ? "ultrasound_mm_primary" : "axis_projection_bounded",
    warning: warnings.length ? warnings.join(" ") : null,
    warnings,
    optionsUsed,
    sampleCount: input.length,
    timestampCount: resolvedTimestamps.length,
    estimatedSampleRate: estimateSampleRate(resolvedTimestamps),
    restInfo,
    axis: axisInfo,
    thresholds: repResult.thresholds,
    arrays: {
      projectedAccG,
      filteredAccG,
      magnitudeMinusG,
      velocityProxy: kinematics.velocityProxy,
      positionProxy: kinematics.positionProxy,
      restMask: kinematics.restMask,
      activeMask: kinematics.activeMask,
      stateByIndex: repResult.stateByIndex,
    },
    ultrasound: ultrasoundInfo.debug,
    reps: mappedReps,
    rejectedCandidates: repResult.rejectedCandidates,
  });

  return mappedReps;
}

function resolveWeightStackTimestamps(samples, timestamps = []) {
  const warnings = [];
  let resolved = [];
  if (Array.isArray(timestamps) && timestamps.length === samples.length && timestamps.some((value) => Number.isFinite(Number(value)))) {
    resolved = timestamps.map((value) => Number.isFinite(Number(value)) ? Number(value) : NaN);
  } else {
    resolved = samples.map((sample) => firstFinite(sample?.timestamp, sample?.time, sample?.t, NaN));
  }
  if (!resolved.some(Number.isFinite)) {
    warnings.push("Missing timestamps; using fallback 20 ms spacing. Timing metrics are approximate.");
    resolved = samples.map((_, index) => index * 20);
  } else {
    const interval = estimateIntervalFromTimestamps(resolved.filter(Number.isFinite));
    resolved = resolved.map((value, index) => Number.isFinite(value) ? value : index * interval);
  }
  const intervals = [];
  for (let index = 1; index < resolved.length; index += 1) {
    const delta = resolved[index] - resolved[index - 1];
    if (delta > 0 && delta < 1000) intervals.push(delta);
  }
  if (intervals.length >= 5 && std(intervals) / Math.max(mean(intervals), 1) > 0.25) {
    warnings.push("Timestamps are jittery; rep timing may be noisy.");
  }
  return { timestamps: resolved, warnings };
}

function findBestRestWindow(samples, timestamps, options) {
  const intervalMs = estimateIntervalFromTimestamps(timestamps);
  const windowCandidates = [Math.min(800, options.restMs), options.restMs, Math.min(1500, Math.max(800, options.restMs))];
  const maxSearchEnd = timestamps[0] + Math.max(options.restMs * 2, 2500);
  let best = { startIndex: 0, endIndex: Math.max(2, Math.round(options.restMs / Math.max(intervalMs, 1))), score: Infinity, restMs: options.restMs };
  for (let start = 0; start < samples.length - 5; start += 1) {
    if (timestamps[start] > maxSearchEnd) break;
    for (const windowMs of windowCandidates) {
      const endTime = timestamps[start] + windowMs;
      let end = start;
      while (end < samples.length && timestamps[end] <= endTime) end += 1;
      if (end - start < 5) continue;
      const slice = samples.slice(start, end);
      const mag = slice.map((sample) => Math.hypot(sample.axG, sample.ayG, sample.azG));
      const score = std(mag) + std(slice.map((sample) => sample.axG)) + std(slice.map((sample) => sample.ayG)) + std(slice.map((sample) => sample.azG));
      if (score < best.score) best = { startIndex: start, endIndex: end - 1, score, restMs: timestamps[end - 1] - timestamps[start] };
    }
  }
  return best;
}

function calibrateWeightStackRest(samples, timestamps, options) {
  const warnings = [];
  const windowInfo = options.enableRestQualityCheck === false
    ? { startIndex: 0, endIndex: Math.max(2, Math.round(options.restMs / Math.max(estimateIntervalFromTimestamps(timestamps), 1))), restMs: options.restMs }
    : findBestRestWindow(samples, timestamps, options);
  const restSamples = samples.slice(windowInfo.startIndex, Math.min(samples.length, windowInfo.endIndex + 1));
  const gVec = {
    x: mean(restSamples.map((sample) => sample.axG)),
    y: mean(restSamples.map((sample) => sample.ayG)),
    z: mean(restSamples.map((sample) => sample.azG)),
  };
  const gMagnitude = Math.hypot(gVec.x, gVec.y, gVec.z);
  const restNoiseSigma = mean([
    std(restSamples.map((sample) => sample.axG)),
    std(restSamples.map((sample) => sample.ayG)),
    std(restSamples.map((sample) => sample.azG)),
  ]);
  const gyroBias = {
    gx: mean(restSamples.map((sample) => sample.gxDps || 0)),
    gy: mean(restSamples.map((sample) => sample.gyDps || 0)),
    gz: mean(restSamples.map((sample) => sample.gzDps || 0)),
  };
  const restQuality = restNoiseSigma < 0.035 && Math.abs(gMagnitude - 1) < 0.25
    ? "good"
    : restNoiseSigma < 0.08 ? "warning" : "bad";
  if (restQuality !== "good") warnings.push(`Rest calibration quality ${restQuality}; using per-recording gravity estimate anyway.`);
  return {
    restStartIndex: windowInfo.startIndex,
    restEndIndex: Math.min(samples.length - 1, windowInfo.endIndex),
    restMs: windowInfo.restMs,
    gVec,
    gMagnitude,
    restNoiseSigma,
    restQuality,
    gyroBias,
    oneDBias: mean(restSamples.map((sample) => sample.axG)),
    warnings,
  };
}

function estimateMotionAxisPca(linearAccVectors, timestamps, restEndIndex, options) {
  const activeVectors = linearAccVectors.slice(Math.min(restEndIndex + 1, linearAccVectors.length - 1));
  const vectors = activeVectors.length >= 6 ? activeVectors : linearAccVectors;
  const variances = [
    variance(vectors.map((value) => value[0])),
    variance(vectors.map((value) => value[1])),
    variance(vectors.map((value) => value[2])),
  ];
  const dominantIndex = variances.indexOf(Math.max(...variances));
  const dominantAxis = ["ax", "ay", "az"][dominantIndex] || "az";
  const dominantVector = normalizeVec([
    dominantIndex === 0 ? 1 : 0,
    dominantIndex === 1 ? 1 : 0,
    dominantIndex === 2 ? 1 : 0,
  ]);
  const totalVariance = variances.reduce((sum, value) => sum + value, 0);
  if (options.enableMotionAxisPca === false || totalVariance <= 0) {
    return {
      method: "dominant_axis",
      movementAxis: dominantVector,
      dominantAxis,
      variance: { ax: variances[0], ay: variances[1], az: variances[2] },
      explainedRatio: totalVariance ? Math.max(...variances) / totalVariance : 0,
    };
  }
  const covariance = [0, 1, 2].map((row) => [0, 1, 2].map((col) => mean(vectors.map((value) => value[row] * value[col]))));
  let axis = normalizeVec([1, 1, 1]);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    axis = normalizeVec([
      covariance[0][0] * axis[0] + covariance[0][1] * axis[1] + covariance[0][2] * axis[2],
      covariance[1][0] * axis[0] + covariance[1][1] * axis[1] + covariance[1][2] * axis[2],
      covariance[2][0] * axis[0] + covariance[2][1] * axis[1] + covariance[2][2] * axis[2],
    ]);
  }
  const axisVariance = mean(vectors.map((value) => dot(value, axis) ** 2));
  const explainedRatio = totalVariance ? axisVariance / totalVariance : 0;
  if (!Number.isFinite(explainedRatio) || explainedRatio < 0.35) {
    return {
      method: "dominant_axis",
      movementAxis: dominantVector,
      dominantAxis,
      variance: { ax: variances[0], ay: variances[1], az: variances[2] },
      explainedRatio,
    };
  }
  return {
    method: "pca",
    movementAxis: axis,
    dominantAxis,
    variance: { ax: variances[0], ay: variances[1], az: variances[2] },
    explainedRatio,
  };
}

function projectOntoAxis(vectors, axis) {
  return vectors.map((vector) => dot(vector, axis));
}

function findFirstActiveIndex(values, startIndex, minActivityG) {
  for (let index = Math.max(0, startIndex); index < values.length; index += 1) {
    if (Math.abs(values[index]) >= minActivityG) return index;
  }
  return null;
}

function buildUltrasoundKinematics(samples, timestamps, options) {
  const rawDistanceMm = samples.map((sample) => {
    const value = Number(sample.distanceMm ?? sample.ultrasoundMm);
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  const validCount = rawDistanceMm.filter((value) => value !== null).length;
  const coverage = samples.length ? validCount / samples.length : 0;
  if (coverage < 0.45) {
    return {
      available: false,
      debug: { available: false, validCount, coverage, note: "No usable HC-SR04 distance stream; falling back to IMU projection." },
    };
  }

  const filledDistance = fillMissingNumericSeries(rawDistanceMm);
  const smoothedDistanceMm = lowPassIIR(filledDistance, timestamps, Math.min(options.cutoffHz, 5));
  const baselineCount = Math.max(5, Math.round(options.restMs / Math.max(estimateIntervalFromTimestamps(timestamps), 1)));
  const restBaseline = percentile(smoothedDistanceMm.slice(0, Math.min(baselineCount, smoothedDistanceMm.length)), 0.5);
  let positionProxy = smoothedDistanceMm.map((value) => restBaseline - value); // weight stack moving away from sensor usually reduces distance
  if (Math.abs(percentile(positionProxy, 0.05)) > Math.abs(percentile(positionProxy, 0.95))) {
    positionProxy = positionProxy.map((value) => -value);
  }
  const velocityProxy = new Array(positionProxy.length).fill(0);
  for (let index = 1; index < positionProxy.length; index += 1) {
    const dt = Math.max((timestamps[index] - timestamps[index - 1]) / 1000, 0.001);
    velocityProxy[index] = (positionProxy[index] - positionProxy[index - 1]) / dt;
  }
  const restSigmaMm = std(positionProxy.slice(0, Math.min(baselineCount, positionProxy.length)));
  const restThresholdMm = Math.max(4, restSigmaMm * 4);
  const restMask = positionProxy.map((value, index) => rawDistanceMm[index] !== null && Math.abs(value) <= restThresholdMm);
  const activeMask = positionProxy.map((value) => Math.abs(value) > restThresholdMm);
  return {
    available: true,
    kinematics: {
      positionProxy,
      velocityProxy,
      restMask,
      activeMask,
      source: "ultrasound_mm",
    },
    debug: {
      available: true,
      source: "HC-SR04 distanceMm",
      validCount,
      coverage,
      restBaselineMm: restBaseline,
      restSigmaMm,
      rawDistanceMm,
      smoothedDistanceMm,
    },
  };
}

function fillMissingNumericSeries(values) {
  const result = values.slice();
  let last = result.find((value) => value !== null);
  if (last === undefined) return result.map(() => 0);
  for (let index = 0; index < result.length; index += 1) {
    if (result[index] === null) result[index] = last;
    else last = result[index];
  }
  for (let index = result.length - 2; index >= 0; index -= 1) {
    if (values[index] === null && values[index + 1] !== null) result[index] = result[index + 1];
  }
  return result.map((value) => Number(value) || 0);
}

function integrateBoundedWeightStackMotion(signalG, timestamps, restInfo, options) {
  const velocityProxy = new Array(signalG.length).fill(0);
  const positionProxy = new Array(signalG.length).fill(0);
  const restMask = new Array(signalG.length).fill(false);
  const activeMask = new Array(signalG.length).fill(false);
  const stillThreshold = Math.max(options.minActivityG, restInfo.restNoiseSigma * 4);
  const stillSamplesNeeded = Math.max(3, Math.round(180 / Math.max(estimateIntervalFromTimestamps(timestamps), 1)));
  let stillCount = 0;
  let bottomBaseline = 0;
  for (let index = 1; index < signalG.length; index += 1) {
    const dt = Math.max((timestamps[index] - timestamps[index - 1]) / 1000, 0.001);
    const acc = Number(signalG[index]) || 0;
    activeMask[index] = Math.abs(acc) >= stillThreshold;
    stillCount = activeMask[index] ? 0 : stillCount + 1;
    velocityProxy[index] = options.enableBoundedIntegration === false
      ? acc
      : velocityProxy[index - 1] * options.velocityLeak + acc * dt;
    positionProxy[index] = options.enableBoundedIntegration === false
      ? signalG[index]
      : positionProxy[index - 1] * options.positionLeak + velocityProxy[index] * dt;
    if (options.enableZuptReset !== false && stillCount >= stillSamplesNeeded) {
      restMask[index] = true;
      velocityProxy[index] = 0;
      bottomBaseline = positionProxy[index];
    }
    if (options.enableZuptReset !== false && stillCount > 0) {
      positionProxy[index] -= bottomBaseline;
    }
  }
  return { velocityProxy, positionProxy, restMask, activeMask };
}

function detectWeightStackRepsFromKinematics(kinematics, timestamps, options) {
  const position = kinematics.positionProxy || [];
  const velocity = kinematics.velocityProxy || [];
  const filteredAcc = kinematics.filteredAccG || [];
  if (!position.length || position.length !== timestamps.length) {
    return {
      reps: [],
      rejectedCandidates: [{ reason: "missing_kinematics" }],
      stateByIndex: new Array(timestamps.length).fill("REST_BOTTOM"),
      thresholds: { activityThresholdG: 0, velocityThreshold: 0, minAmplitudeProxy: 0 },
    };
  }
  const positionRange = percentile(position, 0.95) - percentile(position, 0.05);
  const usingUltrasound = kinematics.source === "ultrasound_mm" || kinematics.ultrasound?.available === true;
  const ultrasoundNoiseMm = kinematics.ultrasound?.debug?.restSigmaMm || 0;
  const activityThresholdG = usingUltrasound
    ? Math.max(4, ultrasoundNoiseMm * 4)
    : Math.max(options.minActivityG, (kinematics.restInfo?.restNoiseSigma || 0) * 4);
  const velocityThreshold = hasNumericWeightStackOption(options.startVelocityThreshold)
    ? Number(options.startVelocityThreshold)
    : usingUltrasound
      ? Math.max(percentile(velocity.map(Math.abs), 0.45), 8)
      : Math.max(percentile(velocity.map(Math.abs), 0.55), activityThresholdG * 0.035, 0.0002);
  const minAmplitudeProxy = hasNumericWeightStackOption(options.minAmplitude)
    ? Number(options.minAmplitude)
    : usingUltrasound
      ? Math.max(positionRange * 0.12, activityThresholdG * 1.5, 10)
      : Math.max(positionRange * 0.08, activityThresholdG * 0.006, 0.00025);
  const result = options.enableStateMachine === false
    ? runWeightStackSimpleCycleFallback({
        position,
        velocity,
        filteredAcc,
        restMask: kinematics.restMask,
        timestamps,
        options,
        thresholds: { activityThreshold: activityThresholdG, velocityThreshold, minAmplitude: minAmplitudeProxy },
      })
    : runWeightStackStateMachine({
        position,
        velocity,
        filteredAcc,
        restMask: kinematics.restMask,
        timestamps,
        options,
        thresholds: { activityThreshold: activityThresholdG, velocityThreshold, minAmplitude: minAmplitudeProxy },
      });
  return {
    ...result,
    thresholds: { activityThresholdG, velocityThreshold, minAmplitudeProxy },
  };
}

function splitMergedWeightStackReps(reps, kinematics, timestamps, options) {
  if (reps.length < 3) return reps;
  const normalDuration = percentile(reps.map((rep) => rep.durationMs).filter((value) => value >= options.minRepMs), 0.5);
  if (!normalDuration) return reps;
  const position = kinematics.positionProxy || [];
  const velocity = kinematics.velocityProxy || [];
  const result = [];
  reps.forEach((rep) => {
    const shouldSplit = rep.durationMs > Math.max(normalDuration * 1.65, options.minRepMs * 2.1);
    if (!shouldSplit) {
      result.push(rep);
      return;
    }
    const splitIndex = Math.round((rep.startIndex + rep.endIndex) / 2);
    const makePart = (startIndex, endIndex) => {
      const slice = position.slice(startIndex, endIndex + 1);
      const localPeakOffset = slice.indexOf(Math.max(...slice));
      const peakIndex = startIndex + Math.max(0, localPeakOffset);
      const amplitude = Math.max(...slice) - Math.min(...slice);
      return {
        ...rep,
        startIndex,
        endIndex,
        startTime: timestamps[startIndex],
        endTime: timestamps[endIndex],
        startTimestamp: timestamps[startIndex],
        endTimestamp: timestamps[endIndex],
        durationMs: timestamps[endIndex] - timestamps[startIndex],
        upStartIndex: startIndex,
        topIndex: peakIndex,
        peakIndex,
        downStartIndex: peakIndex,
        bottomIndex: endIndex,
        upMs: timestamps[peakIndex] - timestamps[startIndex],
        downMs: timestamps[endIndex] - timestamps[peakIndex],
        topPauseMs: 0,
        bottomPauseMs: 0,
        amplitude,
        amplitudeProxy: amplitude,
        peakVelocity: Math.max(...velocity.slice(startIndex, endIndex + 1).map(Math.abs), 0),
        meanVelocity: mean(velocity.slice(startIndex, endIndex + 1).map(Math.abs)),
        qualityFlags: {
          ...rep.qualityFlags,
          tooFastDown: true,
          suspicious: true,
        },
        splitFromMergedRep: true,
      };
    };
    result.push(makePart(rep.startIndex, splitIndex));
    result.push(makePart(Math.min(splitIndex + 1, rep.endIndex), rep.endIndex));
  });
  return result;
}

function runWeightStackStateMachine({ position, velocity, filteredAcc, restMask = [], timestamps, options, thresholds }) {
  const stateByIndex = new Array(position.length).fill("REST_BOTTOM");
  const rejectedCandidates = [];
  const reps = [];
  const bottomLevel = percentile(position, 0.08);
  const startThreshold = bottomLevel + thresholds.minAmplitude * 0.45;
  const bottomThreshold = bottomLevel + thresholds.minAmplitude * 0.28;
  let state = "REST_BOTTOM";
  let candidate = null;
  let lastRepEndTime = -Infinity;

  const reject = (reason, extra = {}) => {
    if (candidate) {
      rejectedCandidates.push({
        reason,
        startIndex: candidate.startIndex,
        endIndex: extra.endIndex ?? null,
        durationMs: extra.durationMs ?? null,
        amplitude: extra.amplitude ?? null,
      });
    }
    candidate = null;
    state = "REST_BOTTOM";
  };

  const finish = (endIndex) => {
    const durationMs = timestamps[endIndex] - timestamps[candidate.startIndex];
    const upMs = timestamps[candidate.topIndex] - timestamps[candidate.upStartIndex];
    const downMs = timestamps[endIndex] - timestamps[candidate.downStartIndex];
    const amplitude = Math.max(...position.slice(candidate.startIndex, endIndex + 1)) -
      Math.min(...position.slice(candidate.startIndex, endIndex + 1));
    const valid = durationMs >= options.minRepMs &&
      durationMs <= options.maxRepMs &&
      upMs >= options.minPhaseMs &&
      downMs >= Math.min(options.minPhaseMs, 80) &&
      amplitude >= thresholds.minAmplitude &&
      timestamps[endIndex] - lastRepEndTime >= options.refractoryMs;

    if (!valid) {
      reject("validation_failed", { endIndex, durationMs, amplitude });
      return;
    }

    reps.push({
      startIndex: candidate.startIndex,
      endIndex,
      startTime: timestamps[candidate.startIndex],
      endTime: timestamps[endIndex],
      startTimestamp: timestamps[candidate.startIndex],
      endTimestamp: timestamps[endIndex],
      durationMs,
      upStartIndex: candidate.upStartIndex,
      topIndex: candidate.topIndex,
      peakIndex: candidate.topIndex,
      downStartIndex: candidate.downStartIndex,
      bottomIndex: endIndex,
      upMs,
      downMs,
      topPauseMs: Math.max(0, timestamps[candidate.downStartIndex] - timestamps[candidate.topIndex]),
      bottomPauseMs: 0,
      amplitude,
      amplitudeProxy: amplitude,
      peakVelocity: Math.max(...velocity.slice(candidate.startIndex, endIndex + 1).map(Math.abs)),
      meanVelocity: mean(velocity.slice(candidate.startIndex, endIndex + 1).map(Math.abs)),
      velocityLoss: 0,
      detectionMethod: "weight_stack_axis_projection_state_machine",
      qualityFlags: {
        partialRep: false,
        tooFastDown: false,
        droppedWeight: false,
        jerky: false,
        suspicious: false,
      },
    });
    lastRepEndTime = timestamps[endIndex];
    candidate = null;
    state = "REST_BOTTOM";
  };

  for (let index = 1; index < position.length; index += 1) {
    const pos = position[index];
    const vel = velocity[index];
    const timestamp = timestamps[index];
    stateByIndex[index] = state;

    if (state === "REST_BOTTOM") {
      if (timestamp - lastRepEndTime < options.refractoryMs) continue;
      if (pos > startThreshold && vel > thresholds.velocityThreshold * 0.25) {
        candidate = {
          startIndex: findWeightStackBottomStart(position, index, bottomThreshold),
          upStartIndex: index,
          topIndex: index,
          downStartIndex: index,
          bottomIndex: index,
        };
        state = "MOVING_UP";
      }
      continue;
    }

    if (!candidate) {
      state = "REST_BOTTOM";
      continue;
    }

    const candidateDuration = timestamp - timestamps[candidate.startIndex];
    if (candidateDuration > options.maxRepMs) {
      reject("timeout", { endIndex: index, durationMs: candidateDuration });
      continue;
    }

    if (state === "MOVING_UP") {
      if (pos >= position[candidate.topIndex]) candidate.topIndex = index;
      const upMs = timestamp - timestamps[candidate.upStartIndex];
      if (upMs >= options.minPhaseMs && vel <= thresholds.velocityThreshold * 0.15) {
        state = "TOP_TURN";
      }
      continue;
    }

    if (state === "TOP_TURN") {
      if (pos >= position[candidate.topIndex]) candidate.topIndex = index;
      if (vel < -thresholds.velocityThreshold * 0.2) {
        candidate.downStartIndex = index;
        state = "MOVING_DOWN";
      }
      continue;
    }

    if (state === "MOVING_DOWN") {
      const downMs = timestamp - timestamps[candidate.downStartIndex];
      if (position[index] <= position[candidate.bottomIndex]) candidate.bottomIndex = index;
      const candidateDuration = timestamp - timestamps[candidate.startIndex];
      if (
        candidateDuration >= options.minRepMs &&
        downMs >= Math.min(options.minPhaseMs, 80) &&
        (
          (pos <= bottomThreshold && Math.abs(vel) <= thresholds.velocityThreshold * 1.4) ||
          restMask[index] === true
        )
      ) {
        state = "BOTTOM_TURN";
        finish(index);
      }
    }
  }

  return { reps, rejectedCandidates, stateByIndex };
}

function runWeightStackSimpleCycleFallback({ position, velocity, filteredAcc, timestamps, options, thresholds }) {
  const stateByIndex = new Array(position.length).fill("SIMPLE_CYCLE");
  const rejectedCandidates = [];
  const reps = [];
  const low = percentile(position, 0.08);
  const startThreshold = low + thresholds.minAmplitude * 0.5;
  const endThreshold = low + thresholds.minAmplitude * 0.3;
  let active = false;
  let startIndex = 0;
  let topIndex = 0;
  let lastEnd = -Infinity;
  for (let index = 0; index < position.length; index += 1) {
    if (!active && position[index] > startThreshold && timestamps[index] - lastEnd >= options.refractoryMs) {
      active = true;
      startIndex = findWeightStackBottomStart(position, index, endThreshold);
      topIndex = index;
      continue;
    }
    if (!active) continue;
    if (position[index] > position[topIndex]) topIndex = index;
    if (index > topIndex && position[index] <= endThreshold) {
      const durationMs = timestamps[index] - timestamps[startIndex];
      const amplitude = position[topIndex] - Math.min(...position.slice(startIndex, index + 1));
      if (durationMs >= options.minRepMs && durationMs <= options.maxRepMs && amplitude >= thresholds.minAmplitude) {
        reps.push({
          startIndex,
          endIndex: index,
          startTime: timestamps[startIndex],
          endTime: timestamps[index],
          startTimestamp: timestamps[startIndex],
          endTimestamp: timestamps[index],
          durationMs,
          upStartIndex: startIndex,
          topIndex,
          peakIndex: topIndex,
          downStartIndex: topIndex,
          bottomIndex: index,
          upMs: timestamps[topIndex] - timestamps[startIndex],
          downMs: timestamps[index] - timestamps[topIndex],
          topPauseMs: 0,
          bottomPauseMs: 0,
          amplitude,
          amplitudeProxy: amplitude,
          peakVelocity: Math.max(...velocity.slice(startIndex, index + 1).map(Math.abs)),
          meanVelocity: mean(velocity.slice(startIndex, index + 1).map(Math.abs)),
          velocityLoss: 0,
          detectionMethod: "weight_stack_axis_projection_state_machine",
          qualityFlags: { partialRep: false, tooFastDown: false, droppedWeight: false, jerky: false, suspicious: false },
        });
        lastEnd = timestamps[index];
      } else {
        rejectedCandidates.push({ reason: "simple_cycle_validation_failed", startIndex, endIndex: index, durationMs, amplitude });
      }
      active = false;
    }
  }
  return { reps, rejectedCandidates, stateByIndex };
}

function findWeightStackBottomStart(position, index, bottomThreshold) {
  for (let i = index; i >= Math.max(0, index - 20); i -= 1) {
    if (position[i] <= bottomThreshold) return i;
  }
  return Math.max(0, index - 2);
}

function enrichWeightStackRepMetrics(reps, kinematics, options) {
  return enrichWeightStackReps(reps, {
    filteredAcc: kinematics.filteredAccG || [],
    velocity: kinematics.velocityProxy || [],
    position: kinematics.positionProxy || [],
    timestamps: kinematics.timestamps || [],
    options,
  });
}

function enrichWeightStackReps(reps, { filteredAcc, velocity, position, timestamps, options }) {
  const baselinePool = reps.slice(0, Math.min(3, reps.length)).map((rep) => rep.amplitude).filter((value) => value > 0);
  const baselineAmplitude = options.enableRomBaseline && baselinePool.length ? mean(baselinePool) : 0;
  const bestPeakVelocity = Math.max(...reps.map((rep) => rep.peakVelocity || 0), 0);
  return reps.map((rep) => {
    const accSlice = filteredAcc.slice(rep.startIndex, rep.endIndex + 1);
    const jerkValues = calculateJerk(accSlice, timestamps.slice(rep.startIndex, rep.endIndex + 1));
    const jerkRms = rms(jerkValues);
    const romRatio = baselineAmplitude ? rep.amplitude / baselineAmplitude : null;
    const velocityLoss = options.enableVelocityLoss && bestPeakVelocity
      ? clamp(1 - (rep.peakVelocity || 0) / bestPeakVelocity, 0, 1)
      : 0;
    const bottomWindow = accSlice.slice(Math.max(0, accSlice.length - 8));
    const droppedWeight = options.enableDroppedWeightDetection &&
      Math.max(...bottomWindow.map(Math.abs), 0) > options.droppedWeightSpikeG;
    const jerkThreshold = hasNumericWeightStackOption(options.jerkThreshold)
      ? Number(options.jerkThreshold)
      : Math.max(rms(filteredAcc) * 3.5, 0.35);
    const partialRep = Boolean(options.enablePartialRepDetection && romRatio !== null && romRatio < options.partialRepRomRatio);
    const tooFastDown = Boolean(options.enableTempoFlags && rep.downMs < options.controlledDownMinMs);
    const jerky = Boolean(options.enableJerkDetection && jerkRms > jerkThreshold);
    return {
      ...rep,
      amplitudeProxy: rep.amplitudeProxy ?? rep.amplitude,
      amplitude: rep.amplitudeProxy ?? rep.amplitude,
      romRatio,
      velocityLoss,
      romCm: options.enableExperimentalDistance === true && hasNumericWeightStackOption(options.cmPerPositionProxy)
        ? (rep.amplitudeProxy ?? rep.amplitude) * Number(options.cmPerPositionProxy)
        : null,
      distanceNote: options.enableExperimentalDistance === true && !hasNumericWeightStackOption(options.cmPerPositionProxy)
        ? "ROM proxy only; not calibrated distance."
        : null,
      jerkRms,
      qualityFlags: {
        ...rep.qualityFlags,
        partialRep,
        tooFastDown,
        droppedWeight,
        jerky,
        suspicious: partialRep || tooFastDown || droppedWeight || jerky,
      },
    };
  });
}

function mapWeightStackRepIndexes(rep, indexMap) {
  const mapIndex = (index) => indexMap[Math.max(0, Math.min(indexMap.length - 1, index))] ?? index;
  return {
    ...rep,
    startIndex: mapIndex(rep.startIndex),
    endIndex: mapIndex(rep.endIndex),
    upStartIndex: mapIndex(rep.upStartIndex),
    topIndex: mapIndex(rep.topIndex),
    peakIndex: mapIndex(rep.peakIndex ?? rep.topIndex),
    downStartIndex: mapIndex(rep.downStartIndex),
    bottomIndex: mapIndex(rep.bottomIndex),
  };
}

function detectGyroAvailability(samples, validIndexes, enabled = false) {
  const gyroMagnitudes = validIndexes.map((index) => {
    const sample = samples[index];
    const gx = Number(sample?.gx);
    const gy = Number(sample?.gy);
    const gz = Number(sample?.gz);
    return [gx, gy, gz].some(Number.isFinite) ? Math.hypot(gx || 0, gy || 0, gz || 0) : null;
  }).filter(Number.isFinite);
  const hasGyro = gyroMagnitudes.length > 0;
  return {
    enabled: Boolean(enabled),
    available: hasGyro,
    gyroRms: hasGyro ? rms(gyroMagnitudes) : 0,
    note: hasGyro
      ? "Gyro detected. GyroAssist is debug-only for weight_stack and does not drive primary rep counting."
      : "No gyro fields detected.",
  };
}

function estimateAutocorrelationCycleHint(values, timestamps) {
  if (!values.length || values.length < 20) return { enabled: true, estimatedCycleMs: null, confidence: 0 };
  const intervalMs = estimateIntervalFromTimestamps(timestamps);
  const centered = values.map((value) => value - mean(values));
  let bestLag = 0;
  let bestScore = -Infinity;
  const minLag = Math.max(3, Math.round(600 / intervalMs));
  const maxLag = Math.min(centered.length - 2, Math.round(5000 / intervalMs));
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    for (let index = lag; index < centered.length; index += 1) score += centered[index] * centered[index - lag];
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return {
    enabled: true,
    estimatedCycleMs: bestLag ? bestLag * intervalMs : null,
    confidence: bestScore > 0 ? 0.4 : 0,
    note: "Hint only; state machine remains primary.",
  };
}

function buildWeightStackDebug(debug) {
  const arrays = debug.arrays || {};
  const keepArrays = debug.optionsUsed?.debugKeepArrays !== false;
  return {
    mode: debug.mode,
    warning: debug.warning ?? null,
    warnings: debug.warnings || [],
    optionsUsed: debug.optionsUsed,
    sampleCount: debug.sampleCount ?? 0,
    timestampCount: debug.timestampCount ?? 0,
    estimatedSampleRate: debug.estimatedSampleRate ?? 0,
    restInfo: debug.restInfo || {
      restStartIndex: 0,
      restEndIndex: 0,
      restMs: debug.optionsUsed?.restMs ?? 0,
      gVec: null,
      gMagnitude: 0,
      restNoiseSigma: 0,
      restQuality: "unknown",
      gyroBias: null,
    },
    axis: debug.axis || {
      method: "unknown",
      movementAxis: null,
      dominantAxis: null,
      variance: null,
      explainedRatio: 0,
    },
    thresholds: debug.thresholds || {
      activityThresholdG: 0,
      velocityThreshold: 0,
      minAmplitudeProxy: 0,
    },
    arrays: keepArrays
      ? arrays
      : Object.fromEntries(Object.entries(arrays).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.slice(-80) : value,
        ])),
    reps: debug.reps || [],
    rejectedCandidates: debug.rejectedCandidates || [],
    ultrasound: debug.ultrasound || { available: false },
    optionalFeatures: debug.optionalFeatures || {},
  };
}

let lastWeightStackKinematicsDebug = null;

function getWeightStackKinematicsDebug() {
  return lastWeightStackKinematicsDebug;
}

function buildWeightStackKinematicsDebugLegacy(inputSamples, calibrationProfile = null) {
  if (!Array.isArray(inputSamples) || inputSamples.length < 20) return null;

  const samples = inputSamples
    .map((sample) => ({
      timestamp: Number(sample.timestamp),
      ax: Number(sample.ax),
      ay: Number(sample.ay),
      az: Number(sample.az),
      gx: Number(sample.gx),
      gy: Number(sample.gy),
      gz: Number(sample.gz),
    }))
    .filter((sample) =>
      ["timestamp", "ax", "ay", "az", "gx", "gy", "gz"].every((key) =>
        Number.isFinite(sample[key])
      )
    );

  if (samples.length < 20) return null;

  const timestamps = samples.map((sample) => sample.timestamp);
  const intervalMs = estimateIntervalFromTimestamps(timestamps) || 20;
  const calibrationBias = calibrationProfile?.bias || {};

  const restWindowCount = Math.max(
    8,
    Math.min(samples.length, Math.round(700 / intervalMs))
  );

  const restSamples = samples.slice(0, restWindowCount);

  const restAcc = {
    x: Number.isFinite(Number(calibrationBias.ax))
      ? Number(calibrationBias.ax)
      : average(restSamples.map((sample) => sample.ax)),
    y: Number.isFinite(Number(calibrationBias.ay))
      ? Number(calibrationBias.ay)
      : average(restSamples.map((sample) => sample.ay)),
    z: Number.isFinite(Number(calibrationBias.az))
      ? Number(calibrationBias.az)
      : average(restSamples.map((sample) => sample.az)),
  };

  const gyroBias = {
    x: Number.isFinite(Number(calibrationBias.gx))
      ? Number(calibrationBias.gx)
      : average(restSamples.map((sample) => sample.gx)),
    y: Number.isFinite(Number(calibrationBias.gy))
      ? Number(calibrationBias.gy)
      : average(restSamples.map((sample) => sample.gy)),
    z: Number.isFinite(Number(calibrationBias.gz))
      ? Number(calibrationBias.gz)
      : average(restSamples.map((sample) => sample.gz)),
  };

  const restGravityMagnitude = Math.max(
    0.65,
    Math.min(1.35, Math.hypot(restAcc.x, restAcc.y, restAcc.z) || 1)
  );

  const filter = new Mahony6DofFilter({
    sampleIntervalSeconds: intervalMs / 1000,
    kp: 1.4,
    ki: 0.015,
    initialAcc: restAcc,
  });

  const linearAccWorld = [];
  const velocityWorld = [];
  const positionWorld = [];

  let vx = 0;
  let vy = 0;
  let vz = 0;

  let px = 0;
  let py = 0;
  let pz = 0;

  let stillCounter = 0;

  const accDeadbandG = 0.018;
  const stillAccThresholdG = 0.035;
  const stillGyroThresholdDps = 4.0;
  const zuptHoldMs = 180;
  const zuptHoldSamples = Math.max(3, Math.round(zuptHoldMs / intervalMs));

  const velocityLeakTauSeconds = 5.0;
  const positionLeakTauSeconds = 18.0;

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const previous = samples[Math.max(0, index - 1)];

    const dt =
      index === 0
        ? intervalMs / 1000
        : Math.max((sample.timestamp - previous.timestamp) / 1000, 0.001);

    const gx = sample.gx - gyroBias.x;
    const gy = sample.gy - gyroBias.y;
    const gz = sample.gz - gyroBias.z;

    filter.update({
      gxDps: gx,
      gyDps: gy,
      gzDps: gz,
      ax: sample.ax,
      ay: sample.ay,
      az: sample.az,
      dt,
    });

    const gravity = filter.getGravityVectorSensorFrame(restGravityMagnitude);

    const linearSensor = {
      x: sample.ax - gravity.x,
      y: sample.ay - gravity.y,
      z: sample.az - gravity.z,
    };

    const linearWorld = filter.rotateSensorVectorToWorld(linearSensor);

    linearWorld.x = applyDeadband(linearWorld.x, accDeadbandG);
    linearWorld.y = applyDeadband(linearWorld.y, accDeadbandG);
    linearWorld.z = applyDeadband(linearWorld.z, accDeadbandG);

    const gyroMagnitude = Math.hypot(gx, gy, gz);
    const accMagnitude = Math.hypot(linearWorld.x, linearWorld.y, linearWorld.z);

    const looksStill =
      accMagnitude < stillAccThresholdG &&
      gyroMagnitude < stillGyroThresholdDps;

    if (looksStill) {
      stillCounter += 1;
    } else {
      stillCounter = 0;
    }

    const velocityLeak = Math.exp(-dt / velocityLeakTauSeconds);
    const positionLeak = Math.exp(-dt / positionLeakTauSeconds);

    vx = vx * velocityLeak + linearWorld.x * dt;
    vy = vy * velocityLeak + linearWorld.y * dt;
    vz = vz * velocityLeak + linearWorld.z * dt;

    if (stillCounter >= zuptHoldSamples) {
      vx = 0;
      vy = 0;
      vz = 0;
    }

    px = px * positionLeak + vx * dt;
    py = py * positionLeak + vy * dt;
    pz = pz * positionLeak + vz * dt;

    linearAccWorld.push({
      x: linearWorld.x,
      y: linearWorld.y,
      z: linearWorld.z,
    });

    velocityWorld.push({
      x: vx,
      y: vy,
      z: vz,
    });

    positionWorld.push({
      x: px,
      y: py,
      z: pz,
    });
  }

  const axisInfo = determineBestKinematicAxis(
    positionWorld,
    velocityWorld,
    linearAccWorld
  );

  let positionProxy = positionWorld.map((value) => value[axisInfo.axis]);
  let velocityProxy = velocityWorld.map((value) => value[axisInfo.axis]);
  let linearAccProxy = linearAccWorld.map((value) => value[axisInfo.axis]);

  if (axisInfo.sign < 0) {
    positionProxy = positionProxy.map((value) => -value);
    velocityProxy = velocityProxy.map((value) => -value);
    linearAccProxy = linearAccProxy.map((value) => -value);
  }

  const positionBaseline = percentile(
    positionProxy.slice(0, restWindowCount),
    0.5
  );
  positionProxy = positionProxy.map((value) => value - positionBaseline);

  const velocityBaseline = percentile(
    velocityProxy.slice(0, restWindowCount),
    0.5
  );
  velocityProxy = velocityProxy.map((value) => value - velocityBaseline);

  const linearAccBaseline = percentile(
    linearAccProxy.slice(0, restWindowCount),
    0.5
  );
  linearAccProxy = linearAccProxy.map((value) => value - linearAccBaseline);

  positionProxy = movingAverage(
    positionProxy,
    Math.max(3, Math.round(80 / intervalMs))
  );

  velocityProxy = movingAverage(
    velocityProxy,
    Math.max(3, Math.round(60 / intervalMs))
  );

  linearAccProxy = movingAverage(
    linearAccProxy,
    Math.max(3, Math.round(40 / intervalMs))
  );

  const fallbackGithub = buildGithubInspiredKinematicsDebugLegacy(samples, calibrationProfile);

  const result = {
    method: "mahony_6dof_velocity_position_proxy",
    timestamps,
    axis: axisInfo.axis,
    axisSign: axisInfo.sign,
    restAcc,
    gyroBias,
    linearAccWorld,
    linearAccProxy,
    velocityProxy,
    positionProxy,
    positionWorld,
    velocityWorld,
    fallbackGithub,
  };

  lastWeightStackKinematicsDebug = result;
  return result;
}

function determineBestKinematicAxis(positionWorld, velocityWorld, linearAccWorld) {
  const axes = ["x", "y", "z"];

  const scores = axes.map((axis) => {
    const positionValues = positionWorld.map((value) => value[axis]);
    const velocityValues = velocityWorld.map((value) => value[axis]);
    const accValues = linearAccWorld.map((value) => value[axis]);

    const positionRange =
      percentile(positionValues, 0.95) - percentile(positionValues, 0.05);
    const velocityRange =
      percentile(velocityValues, 0.95) - percentile(velocityValues, 0.05);
    const accRange =
      percentile(accValues, 0.95) - percentile(accValues, 0.05);

    const p95 = percentile(positionValues, 0.95);
    const p05 = percentile(positionValues, 0.05);
    const sign = Math.abs(p95) >= Math.abs(p05) ? 1 : -1;

    return {
      axis,
      sign,
      score:
        Math.abs(positionRange) * 2.0 +
        Math.abs(velocityRange) * 0.7 +
        Math.abs(accRange) * 0.15,
    };
  });

  return scores.sort((a, b) => b.score - a.score)[0] || {
    axis: "z",
    sign: 1,
    score: 0,
  };
}

function applyDeadband(value, deadband) {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) <= deadband) return 0;
  return value - Math.sign(value) * deadband;
}

class Mahony6DofFilter {
  constructor({
    sampleIntervalSeconds = 0.02,
    kp = 1.2,
    ki = 0.0,
    initialAcc = { x: 0, y: 0, z: 1 },
  } = {}) {
    this.sampleIntervalSeconds = sampleIntervalSeconds;
    this.twoKp = 2 * kp;
    this.twoKi = 2 * ki;

    this.integralFBx = 0;
    this.integralFBy = 0;
    this.integralFBz = 0;

    const initialQuaternion = quaternionFromAccel(initialAcc);

    this.q0 = initialQuaternion.w;
    this.q1 = initialQuaternion.x;
    this.q2 = initialQuaternion.y;
    this.q3 = initialQuaternion.z;
  }

  update({
    gxDps,
    gyDps,
    gzDps,
    ax,
    ay,
    az,
    dt = this.sampleIntervalSeconds,
  }) {
    let gx = degToRad(gxDps);
    let gy = degToRad(gyDps);
    let gz = degToRad(gzDps);

    let norm = Math.hypot(ax, ay, az);

    if (norm > 0.0001) {
      ax /= norm;
      ay /= norm;
      az /= norm;

      const halfvx = this.q1 * this.q3 - this.q0 * this.q2;
      const halfvy = this.q0 * this.q1 + this.q2 * this.q3;
      const halfvz = this.q0 * this.q0 - 0.5 + this.q3 * this.q3;

      const halfex = ay * halfvz - az * halfvy;
      const halfey = az * halfvx - ax * halfvz;
      const halfez = ax * halfvy - ay * halfvx;

      if (this.twoKi > 0) {
        this.integralFBx += this.twoKi * halfex * dt;
        this.integralFBy += this.twoKi * halfey * dt;
        this.integralFBz += this.twoKi * halfez * dt;

        gx += this.integralFBx;
        gy += this.integralFBy;
        gz += this.integralFBz;
      } else {
        this.integralFBx = 0;
        this.integralFBy = 0;
        this.integralFBz = 0;
      }

      gx += this.twoKp * halfex;
      gy += this.twoKp * halfey;
      gz += this.twoKp * halfez;
    }

    gx *= 0.5 * dt;
    gy *= 0.5 * dt;
    gz *= 0.5 * dt;

    const qa = this.q0;
    const qb = this.q1;
    const qc = this.q2;
    const qd = this.q3;

    this.q0 += -qb * gx - qc * gy - qd * gz;
    this.q1 += qa * gx + qc * gz - qd * gy;
    this.q2 += qa * gy - qb * gz + qd * gx;
    this.q3 += qa * gz + qb * gy - qc * gx;

    this.normalize();
  }

  normalize() {
    const norm = Math.hypot(this.q0, this.q1, this.q2, this.q3) || 1;

    this.q0 /= norm;
    this.q1 /= norm;
    this.q2 /= norm;
    this.q3 /= norm;
  }

  getGravityVectorSensorFrame(magnitude = 1) {
    return {
      x: 2 * (this.q1 * this.q3 - this.q0 * this.q2) * magnitude,
      y: 2 * (this.q0 * this.q1 + this.q2 * this.q3) * magnitude,
      z:
        (this.q0 * this.q0 -
          this.q1 * this.q1 -
          this.q2 * this.q2 +
          this.q3 * this.q3) *
        magnitude,
    };
  }

  rotateSensorVectorToWorld(vector) {
    return rotateVectorByQuaternion(vector, {
      w: this.q0,
      x: this.q1,
      y: this.q2,
      z: this.q3,
    });
  }
}

function quaternionFromAccel(acc) {
  const ax = Number(acc.x) || 0;
  const ay = Number(acc.y) || 0;
  const az = Number(acc.z) || 1;

  const roll = Math.atan2(ay, az);
  const pitch = Math.atan2(-ax, Math.sqrt(ay * ay + az * az));
  const yaw = 0;

  return quaternionFromEuler(roll, pitch, yaw);
}

function quaternionFromEuler(roll, pitch, yaw) {
  const cr = Math.cos(roll * 0.5);
  const sr = Math.sin(roll * 0.5);
  const cp = Math.cos(pitch * 0.5);
  const sp = Math.sin(pitch * 0.5);
  const cy = Math.cos(yaw * 0.5);
  const sy = Math.sin(yaw * 0.5);

  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
  };
}

function rotateVectorByQuaternion(vector, q) {
  const vx = vector.x;
  const vy = vector.y;
  const vz = vector.z;

  const qw = q.w;
  const qx = q.x;
  const qy = q.y;
  const qz = q.z;

  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;

  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

function degToRad(value) {
  return ((Number(value) || 0) * Math.PI) / 180;
}

function safeClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildGithubInspiredKinematicsDebugLegacy(samples, calibrationProfile = null) {
  const timestamps = samples.map((sample) => sample.timestamp);
  const intervalMs = estimateIntervalFromTimestamps(timestamps) || 20;
  const calibrationBias = calibrationProfile?.bias || {};

  let smoothAy = Number.isFinite(Number(calibrationBias.ay))
    ? Number(calibrationBias.ay)
    : samples[0].ay;

  let smoothAz = Number.isFinite(Number(calibrationBias.az))
    ? Number(calibrationBias.az)
    : samples[0].az;

  let smoothGx = Number.isFinite(Number(calibrationBias.gx))
    ? Number(calibrationBias.gx)
    : samples[0].gx;

  const gyroBiasX = Number.isFinite(Number(calibrationBias.gx))
    ? Number(calibrationBias.gx)
    : 0;

  let angleXDeg = 0;
  let speedY = 0;
  let positionProxyY = 0;

  const linearY = [];
  const speed = [];
  const positionProxyRaw = [];
  const angle = [];

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const previous = samples[Math.max(0, index - 1)];

    const dt =
      index === 0
        ? intervalMs / 1000
        : Math.max((sample.timestamp - previous.timestamp) / 1000, 0.001);

    smoothAy = smoothAy * 0.99 + sample.ay * 0.01;
    smoothAz = smoothAz * 0.99 + sample.az * 0.01;
    smoothGx = smoothGx * 0.99 + sample.gx * 0.01;

    angleXDeg += (smoothGx - gyroBiasX) * dt;

    const zGravity = safeClamp(smoothAz, -1, 1);
    const yGravityMagnitude = Math.sqrt(Math.max(0, 1 - zGravity * zGravity));

    let realAccelY =
      angleXDeg > 0
        ? smoothAy - yGravityMagnitude
        : smoothAy + yGravityMagnitude;

    if (Math.abs(realAccelY) < 0.15) {
      realAccelY = 0;
    }

    speedY += realAccelY * dt;
    positionProxyY += speedY * dt;

    linearY.push(realAccelY);
    speed.push(speedY);
    positionProxyRaw.push(positionProxyY);
    angle.push(angleXDeg);
  }

  const baselineCount = Math.max(5, Math.round(700 / intervalMs));
  const baseline = percentile(positionProxyRaw.slice(0, baselineCount), 0.5);
  const positionProxy = positionProxyRaw.map((value) => value - baseline);

  return {
    method: "github_inspired_y_axis",
    linearAccProxy: linearY,
    velocityProxy: speed,
    positionProxy,
    angleXDeg: angle,
  };
}

function detectWeightStackRepsFromKinematicsDebugLegacy(kinematics, timestamps) {
  if (!kinematics?.positionProxy?.length || !Array.isArray(timestamps)) {
    return [];
  }

  const position = kinematics.positionProxy;
  const velocity = kinematics.velocityProxy || new Array(position.length).fill(0);

  if (position.length !== timestamps.length) return [];

  const p05 = percentile(position, 0.05);
  const p95 = percentile(position, 0.95);
  const range = p95 - p05;

  if (!Number.isFinite(range) || Math.abs(range) < 0.0008) {
    const github = kinematics.fallbackGithub;

    if (github?.positionProxy?.length === timestamps.length) {
      return detectWeightStackRepsFromPositionAndVelocityDebugLegacy(
        github.positionProxy,
        github.velocityProxy,
        timestamps,
        "github_fallback_position"
      );
    }

    return [];
  }

  const markers = detectWeightStackRepsFromPositionAndVelocityDebugLegacy(
    position,
    velocity,
    timestamps,
    "mahony_position_proxy"
  );

  if (
    markers.length === 0 &&
    kinematics.fallbackGithub?.positionProxy?.length === timestamps.length
  ) {
    const fallbackMarkers = detectWeightStackRepsFromPositionAndVelocityDebugLegacy(
      kinematics.fallbackGithub.positionProxy,
      kinematics.fallbackGithub.velocityProxy,
      timestamps,
      "github_fallback_position"
    );

    if (fallbackMarkers.length > 0) return fallbackMarkers;
  }

  return markers;
}

function detectWeightStackRepsFromPositionAndVelocityDebugLegacy(
  positionInput,
  velocityInput,
  timestamps,
  method = "position_velocity_proxy"
) {
  if (!positionInput.length || positionInput.length !== timestamps.length) {
    return [];
  }

  const intervalMs = estimateIntervalFromTimestamps(timestamps) || 20;

  let position = movingAverage(
    positionInput,
    Math.max(3, Math.round(90 / intervalMs))
  );

  let velocity = movingAverage(
    velocityInput,
    Math.max(3, Math.round(70 / intervalMs))
  );

  const initialCount = Math.max(
    8,
    Math.min(position.length, Math.round(700 / intervalMs))
  );

  const startLevel = percentile(position.slice(0, initialCount), 0.5);
  position = position.map((value) => value - startLevel);

  const p05 = percentile(position, 0.05);
  const p95 = percentile(position, 0.95);

  if (Math.abs(p05) > Math.abs(p95)) {
    position = position.map((value) => -value);
    velocity = velocity.map((value) => -value);
  }

  const low = percentile(position, 0.05);
  const high = percentile(position, 0.95);
  const range = high - low;

  if (!Number.isFinite(range) || range < 0.0008) return [];

  const startThreshold = Math.max(range * 0.2, 0.00045);
  const endThreshold = Math.max(range * 0.13, 0.00025);
  const validRomThreshold = Math.max(range * 0.34, 0.0007);

  const minRepDurationMs = 700;
  const maxRepDurationMs = 10000;
  const minSamples = 15;

  const startHoldSamples = Math.max(2, Math.round(100 / intervalMs));
  const endHoldSamples = Math.max(4, Math.round(260 / intervalMs));
  const refractoryMs = 250;

  const correctionDropThreshold = range * 0.14;
  const correctionRecoverThreshold = range * 0.07;

  const markers = [];

  let state = "idle";

  let startIndex = 0;
  let peakIndex = 0;
  let maxPosition = -Infinity;

  let aboveStartCount = 0;
  let belowEndCount = 0;
  let lastRepEndTimestamp = -Infinity;

  let correctionCount = 0;
  let correctionArmed = false;
  let firstAttemptRomProxy = null;

  function reset() {
    state = "idle";
    startIndex = 0;
    peakIndex = 0;
    maxPosition = -Infinity;
    aboveStartCount = 0;
    belowEndCount = 0;
    correctionCount = 0;
    correctionArmed = false;
    firstAttemptRomProxy = null;
  }

  function findStartIndex(index) {
    const backSamples = Math.max(3, Math.round(500 / intervalMs));

    for (let i = index; i >= Math.max(0, index - backSamples); i -= 1) {
      if (position[i] <= endThreshold) return i;
    }

    return Math.max(0, index - Math.round(150 / intervalMs));
  }

  function finishRep(endIndex, forced = false) {
    const durationMs = timestamps[endIndex] - timestamps[startIndex];
    const sampleCount = endIndex - startIndex + 1;

    const valid =
      durationMs >= minRepDurationMs &&
      durationMs <= maxRepDurationMs &&
      sampleCount >= minSamples &&
      maxPosition >= validRomThreshold;

    if (valid) {
      markers.push({
        startIndex,
        peakIndex,
        endIndex,
        direction: 1,
        amplitudeProxy: maxPosition,
        maxRomProxy: maxPosition,
        firstAttemptRomProxy: firstAttemptRomProxy ?? maxPosition,
        correctionDetected: correctionCount > 0,
        correctionCount,
        durationMs,
        completed: true,
        forced,
        detectionMethod: method,
      });

      lastRepEndTimestamp = timestamps[endIndex];
    }

    reset();
  }

  for (let index = 0; index < position.length; index += 1) {
    const pos = position[index];
    const timestamp = timestamps[index];

    if (state === "idle") {
      if (timestamp - lastRepEndTimestamp < refractoryMs) continue;

      if (pos >= startThreshold) {
        aboveStartCount += 1;
      } else {
        aboveStartCount = 0;
      }

      if (aboveStartCount >= startHoldSamples) {
        state = "active";
        startIndex = findStartIndex(index);
        peakIndex = index;
        maxPosition = pos;
        belowEndCount = 0;
        correctionCount = 0;
        correctionArmed = false;
        firstAttemptRomProxy = null;
      }

      continue;
    }

    const durationMs = timestamp - timestamps[startIndex];

    if (pos > maxPosition) {
      if (
        correctionArmed &&
        pos >= maxPosition + correctionRecoverThreshold &&
        maxPosition >= validRomThreshold * 0.45
      ) {
        correctionCount += 1;
        correctionArmed = false;
      }

      maxPosition = pos;
      peakIndex = index;
    }

    if (
      firstAttemptRomProxy === null &&
      maxPosition >= validRomThreshold * 0.45 &&
      pos <= maxPosition - correctionDropThreshold &&
      pos > endThreshold
    ) {
      firstAttemptRomProxy = maxPosition;
      correctionArmed = true;
    }

    if (pos <= endThreshold && maxPosition >= validRomThreshold) {
      belowEndCount += 1;
    } else {
      belowEndCount = 0;
    }

    if (belowEndCount >= endHoldSamples && durationMs >= minRepDurationMs) {
      const endIndex = Math.max(startIndex, index - belowEndCount + 1);
      finishRep(endIndex, false);
      continue;
    }

    if (durationMs > maxRepDurationMs && maxPosition >= validRomThreshold) {
      finishRep(index, true);
    }
  }

  return markers;
}

function detectWeightStackRepsLegacyDebugOnly(rawSignal, timestamps) {
  if (!rawSignal.length || rawSignal.length !== timestamps.length) return [];

  const intervalMs = estimateIntervalFromTimestamps(timestamps);
  const filtered = lowPassFilter(rawSignal, 0.15);
  const baselineWindow = Math.max(9, Math.round(1200 / intervalMs));
  const baseline = movingAverage(filtered, baselineWindow);
  const centered = filtered.map((value, index) => value - baseline[index]);
  const absSignal = movingAverage(
    centered.map(Math.abs),
    Math.max(3, Math.round(120 / intervalMs))
  );

  const threshold = Math.max(0.04, standardDeviation(centered) * 0.45);
  const minimumAboveMs = 120;
  const minimumBelowMs = 200;
  const minimumRepDurationMs = 700;
  const maximumRepDurationMs = 6000;
  const minimumSamples = 15;
  const refractoryMs = 250;
  const minimumAmplitude = Math.max(0.045, threshold * 1.4);

  const markers = [];

  let state = "rest";
  let aboveStartIndex = null;
  let startIndex = 0;
  let peakIndex = 0;
  let peakAbs = 0;
  let lastActiveIndex = 0;
  let lastRepEndTimestamp = -Infinity;

  for (let index = 0; index < absSignal.length; index += 1) {
    const timestamp = timestamps[index];
    const value = absSignal[index];

    if (state === "rest") {
      if (timestamp - lastRepEndTimestamp < refractoryMs) continue;

      if (value >= threshold) {
        if (aboveStartIndex === null) aboveStartIndex = index;

        state = "moving";
        startIndex = Math.max(
          0,
          aboveStartIndex - Math.max(1, Math.round(minimumAboveMs / intervalMs))
        );

        peakIndex = index;
        peakAbs = value;
        lastActiveIndex = index;
      } else if (value < threshold * 0.8) {
        aboveStartIndex = null;
      }

      continue;
    }

    if (value > peakAbs) {
      peakAbs = value;
      peakIndex = index;
    }

    if (value >= threshold) {
      lastActiveIndex = index;
    }

    if (timestamp - timestamps[lastActiveIndex] >= minimumBelowMs) {
      const endIndex = Math.min(
        index,
        lastActiveIndex + Math.max(1, Math.round(minimumBelowMs / intervalMs))
      );

      const durationMs = timestamps[endIndex] - timestamps[startIndex];
      const sampleCount = endIndex - startIndex + 1;
      const amplitudeProxy = percentile(
        absSignal.slice(startIndex, endIndex + 1),
        0.95
      );

      const hasRealMovement =
        durationMs >= minimumRepDurationMs &&
        durationMs <= maximumRepDurationMs &&
        sampleCount >= minimumSamples &&
        amplitudeProxy >= minimumAmplitude;

      if (hasRealMovement) {
        markers.push({
          startIndex,
          peakIndex,
          endIndex,
          direction: Math.sign(centered[peakIndex]) || 1,
          amplitudeProxy,
          detectionMethod: "legacy_activity",
        });

        lastRepEndTimestamp = timestamps[endIndex];
      }

      state = "rest";
      aboveStartIndex = null;
      peakAbs = 0;
    }
  }

  return markers;
}

function detectRepsCycleBased(signal, timestamps, options = {}) {
  if (!signal.length) return [];
  const minimumRepDurationMs = options.minimumRepDurationMs || 700;
  const minimumRestMs = options.minimumRestMs || 120;
  const baseline = movingAverage(signal, Math.max(9, Math.round(900 / estimateIntervalFromTimestamps(timestamps))));
  const centered = signal.map((value, index) => value - baseline[index]);
  const envelope = movingAverage(centered.map(Math.abs), 5);
  const threshold = Math.max(0.035, average(envelope) + standardDeviation(envelope) * 0.55);
  const restThreshold = threshold * 0.45;
  const markers = [];
  let state = "rest";
  let startIndex = 0;
  let peakIndex = 0;
  let peakAbs = 0;
  let restCandidateIndex = null;

  for (let index = 1; index < envelope.length; index += 1) {
    if (state === "rest" && envelope[index] > threshold) {
      state = "moving";
      startIndex = Math.max(0, index - 1);
      peakIndex = index;
      peakAbs = envelope[index];
      restCandidateIndex = null;
      continue;
    }

    if (state !== "moving") continue;
    if (envelope[index] > peakAbs) {
      peakAbs = envelope[index];
      peakIndex = index;
    }

    if (envelope[index] <= restThreshold) {
      if (restCandidateIndex === null) restCandidateIndex = index;
      const restDuration = timestamps[index] - timestamps[restCandidateIndex];
      const repDuration = timestamps[index] - timestamps[startIndex];
      if (restDuration >= minimumRestMs && repDuration >= minimumRepDurationMs) {
        markers.push({
          startIndex,
          peakIndex,
          endIndex: index,
          direction: Math.sign(centered[peakIndex]) || 1,
        });
        state = "rest";
        restCandidateIndex = null;
      }
    } else {
      restCandidateIndex = null;
    }
  }

  return markers;
}

function detectReps(signal, timestamps, options = {}) {
  return detectRepsCycleBased(signal, timestamps, options);
}

function segmentReps(inputSamples, repMarkers) {
  return repMarkers.map((marker, index) => {
    const peakIndex = Number.isFinite(marker?.peakIndex) ? marker.peakIndex : marker;
    const previousPeak = Number.isFinite(repMarkers[index - 1]?.peakIndex) ? repMarkers[index - 1].peakIndex : repMarkers[index - 1];
    const nextPeak = Number.isFinite(repMarkers[index + 1]?.peakIndex) ? repMarkers[index + 1].peakIndex : repMarkers[index + 1];
    const startIndex = Number.isFinite(marker?.startIndex)
      ? marker.startIndex
      : previousPeak === undefined ? 0 : Math.floor((previousPeak + peakIndex) / 2);
    const endIndex = Number.isFinite(marker?.endIndex)
      ? marker.endIndex
      : nextPeak === undefined ? inputSamples.length - 1 : Math.floor((peakIndex + nextPeak) / 2);
    return {
      startIndex,
      peakIndex,
      endIndex,
      startTimestamp: inputSamples[startIndex]?.timestamp || 0,
      peakTimestamp: inputSamples[peakIndex]?.timestamp || 0,
      endTimestamp: inputSamples[endIndex]?.timestamp || 0,
      marker,
    };
  });
}

function calculateRepMetrics(repSegments, mode) {
  return repSegments.map((segment, index) => {
    const marker = segment.marker || {};
    const amplitudeProxy = Number.isFinite(Number(marker.amplitudeProxy ?? marker.amplitude))
      ? Number(marker.amplitudeProxy ?? marker.amplitude)
      : Math.max(0, percentile(segment.primary, 0.95) - percentile(segment.primary, 0.05));
    const durationMs = Number.isFinite(Number(marker.durationMs))
      ? Number(marker.durationMs)
      : Math.max(0, segment.endTimestamp - segment.startTimestamp);
    const velocityProxy = Number.isFinite(Number(marker.meanVelocity))
      ? Number(marker.meanVelocity)
      : amplitudeProxy / Math.max(durationMs / 1000, 0.001);
    const highFrequencyRms = rms(segment.highFrequency);
    const jerkRms = rms(segment.jerk);
    const tremorScore = highFrequencyRms + jerkRms * 0.015;
    const smoothnessScore = Math.round(clamp(100 - (highFrequencyRms / Math.max(standardDeviation(segment.primary), 0.02)) * 48 - jerkRms * 0.45, 0, 100));
    const avgGyro = average(segment.gyroMagnitude);
    const maxGyro = Math.max(...segment.gyroMagnitude, 0);
    const gyroPenalty = mode === "weight_stack" ? 1.25 : mode === "barbell" ? 0.85 : 0.95;
    const gyroStabilityScore = Math.round(clamp(100 - avgGyro * gyroPenalty - maxGyro * 0.18, 0, 100));
    const maxTiltProxy = Math.max(...segment.secondary.map(Math.abs), 0);
    const barTiltScore = Math.round(clamp(100 - maxTiltProxy * 0.55, 0, 100));
    return {
      repNumber: index + 1,
      repIndex: index,
      startTime: segment.startTimestamp,
      endTime: segment.endTimestamp,
      durationMs,
      concentricDurationProxy: durationMs ? Math.round(durationMs * 0.5) : 0,
      eccentricDurationProxy: durationMs ? Math.round(durationMs * 0.5) : 0,
      peakValue: segment.primary.length ? Math.max(...segment.primary.map(Math.abs)) : 0,
      amplitudeProxy,
      ROMProxy: amplitudeProxy,
      romRatio: Number.isFinite(Number(marker.romRatio)) ? Number(marker.romRatio) : null,
      romRelativeToReference: null,
      velocityProxy,
      velocityLossPercent: Number.isFinite(Number(marker.velocityLoss)) ? Math.round(Number(marker.velocityLoss) * 100) : 0,
      smoothnessScore,
      jerkScore: jerkRms,
      tremorScore,
      gyroStabilityScore,
      barTiltScore,
      maxTiltProxy,
      tiltProxy: maxTiltProxy,
      curveSimilarity: null,
      qualityClass: "uncertain",
      qualityReasons: [],
      qualityFlags: marker.qualityFlags || {},
      upMs: marker.upMs || 0,
      downMs: marker.downMs || 0,
      topPauseMs: marker.topPauseMs || 0,
      bottomPauseMs: marker.bottomPauseMs || 0,
      peakVelocity: marker.peakVelocity || 0,
      meanVelocity: marker.meanVelocity || velocityProxy,
      jerkRms: marker.jerkRms || jerkRms,
      leftRightImbalanceProxy: mode === "barbell" ? maxTiltProxy : null,
      wobbleScore: mode === "barbell" ? 100 - barTiltScore : 100 - gyroStabilityScore,
    };
  });
}

function validateSampleRate(inputSamples, mode = "free_movement") {
  const intervals = [];
  for (let index = 1; index < inputSamples.length; index += 1) {
    const interval = inputSamples[index].timestamp - inputSamples[index - 1].timestamp;
    if (interval > 0 && interval < 1000) intervals.push(interval);
  }
  const medianInterval = intervals.length ? percentile(intervals, 0.5) : 0;
  const sampleRateHz = medianInterval ? 1000 / medianInterval : 0;
  const jitterRatio = intervals.length ? standardDeviation(intervals) / Math.max(average(intervals), 1) : 1;
  const gyroValues = inputSamples.map((sample) => Math.hypot(sample.gx, sample.gy, sample.gz));
  const accSpread = Math.max(
    standardDeviation(inputSamples.map((sample) => sample.ax)),
    standardDeviation(inputSamples.map((sample) => sample.ay)),
    standardDeviation(inputSamples.map((sample) => sample.az)),
  );
  const issues = [];
  if (inputSamples.length < MIN_ANALYSIS_SAMPLES) issues.push("Zu wenige Samples");
  if (sampleRateHz && (sampleRateHz < 18 || sampleRateHz > 80)) issues.push("Datenrate außerhalb des erwarteten Bereichs");
  if (jitterRatio > 0.22) issues.push("Datenrate schwankt deutlich");
  if (accSpread < 0.025) issues.push("Bewegungssignal sehr klein");
  if (mode === "weight_stack" && percentile(gyroValues, 0.9) > 35) issues.push("Gyro beim Gewichtsblock ungewöhnlich hoch");
  return {
    status: issues.length ? "uncertain" : "good",
    issues,
    sampleRateHz,
    jitterRatio,
  };
}

function assessReferenceQuality(metrics) {
  const issues = [];
  if (metrics.durationMs < 1500 || metrics.repMetrics.length < 3) issues.push("mindestens 3 saubere Reps empfohlen");
  const amplitudes = metrics.repMetrics.map((rep) => rep.amplitudeProxy).filter(Boolean);
  const durations = metrics.repMetrics.map((rep) => rep.durationMs).filter(Boolean);
  const tremors = metrics.repMetrics.map((rep) => rep.tremorScore).filter(Number.isFinite);
  if (amplitudes.length >= 3 && standardDeviation(amplitudes) / Math.max(average(amplitudes), 0.001) > 0.22) issues.push("ROM ungleichmäßig");
  if (durations.length >= 3 && standardDeviation(durations) / Math.max(average(durations), 1) > 0.22) issues.push("Rep-Dauer schwankt");
  if (average(tremors) > 1.6) issues.push("Ruckeln/Zittern erhöht");
  if (metrics.sensorQuality?.status !== "good") issues.push("Messqualität unsicher");
  return {
    status: issues.length ? "warning" : "good",
    issues,
  };
}

function applyVelocityLoss(repMetrics) {
  const baseline = average(repMetrics.slice(0, Math.min(3, repMetrics.length)).map((rep) => rep.velocityProxy).filter(Boolean));
  repMetrics.forEach((rep) => {
    rep.velocityLossPercent = baseline ? clamp(((baseline - rep.velocityProxy) / baseline) * 100, -100, 100) : 0;
  });
}

function applyRomRelativeToReference(repMetrics, referenceRepMetrics = []) {
  const referenceRom = average(referenceRepMetrics.map((rep) => rep.amplitudeProxy).filter(Boolean));
  repMetrics.forEach((rep) => {
    rep.romRelativeToReference = referenceRom ? clamp((rep.amplitudeProxy / referenceRom) * 100, 0, 200) : null;
    rep.romPercent = rep.romRelativeToReference;
  });
}

function tremorLevelFromScore(score) {
  if (!Number.isFinite(Number(score))) return "medium";
  if (score > 2.2) return "high";
  if (score > 1.1) return "medium";
  return "low";
}

function applyRepFeedback(repMetrics, fatigue = {}, mode = "free_movement") {
  repMetrics.forEach((rep) => {
    rep.romPercent = Number.isFinite(rep.romRelativeToReference) ? Math.round(rep.romRelativeToReference) : null;
    rep.tremorLevel = tremorLevelFromScore(rep.tremorScore);
    rep.fatigueFlag = Boolean(fatigue.fatigueDetected && rep.repNumber >= fatigue.fatigueStartRep);
    const reasons = new Set(rep.qualityReasons || []);
    if (rep.fatigueFlag) reasons.add("Tempo fällt ab");
    if (rep.romPercent !== null && rep.romPercent < 85) reasons.add("ROM verkürzt");
    if (rep.tremorLevel === "high") reasons.add("Ruckeln erhöht");

    if (rep.qualityClass === "clean" && !rep.fatigueFlag) {
      rep.feedbackText = "Sauber";
    } else if (reasons.has("ROM verkürzt") || reasons.has("ROM")) {
      rep.feedbackText = "ROM verkürzt";
    } else if (reasons.has("Tempo") || reasons.has("Tempo fällt ab")) {
      rep.feedbackText = "Tempo fällt ab";
    } else if (reasons.has("Ruckeln") || reasons.has("Ruckeln erhöht")) {
      rep.feedbackText = "Ruckeln erhöht";
    } else if (mode === "weight_stack" && reasons.has("Messung unsicher")) {
      rep.feedbackText = "Messung unsicher";
    } else {
      rep.feedbackText = rep.qualityClass === "bad" ? "Ausführung unsauber" : "Grenzwertig";
    }
    rep.audioCue = buildAudioCueForRep(rep, { fatigue });
  });
}

function calculateWeightStackScore({ repMetrics, referenceRepMetrics = [], tempoConsistencyScore = 0, tremorScore = 0 }) {
  if (!repMetrics.length) return 0;
  const referenceRom = average(referenceRepMetrics.map((rep) => rep.amplitudeProxy).filter(Boolean));
  const referenceDuration = average(referenceRepMetrics.map((rep) => rep.durationMs).filter(Boolean));
  const referenceVelocity = average(referenceRepMetrics.map((rep) => rep.velocityProxy).filter(Number.isFinite));
  const referenceTremor = average(referenceRepMetrics.map((rep) => rep.tremorScore).filter(Number.isFinite));

  const romScore = referenceRom
    ? clamp(100 - Math.abs((average(repMetrics.map((rep) => rep.amplitudeProxy)) / referenceRom) * 100 - 100) * 2.2, 0, 100)
    : clamp(100 - (standardDeviation(repMetrics.map((rep) => rep.amplitudeProxy)) / Math.max(average(repMetrics.map((rep) => rep.amplitudeProxy)), 0.001)) * 180, 0, 100);
  const durationScore = referenceDuration
    ? percentSimilarity(average(repMetrics.map((rep) => rep.durationMs)), referenceDuration)
    : tempoConsistencyScore;
  const velocityScore = referenceVelocity
    ? percentSimilarity(average(repMetrics.map((rep) => rep.velocityProxy)), referenceVelocity)
    : clamp(100 - Math.max(0, ...repMetrics.map((rep) => rep.velocityLossPercent || 0)) * 2, 0, 100);
  const tempoVelocityScore = clamp(durationScore * 0.45 + velocityScore * 0.55, 0, 100);
  const tremorScorePart = referenceTremor
    ? clamp(100 - Math.max(0, percentDifference(tremorScore, referenceTremor)) * 1.8, 0, 100)
    : clamp(100 - tremorScore * 20, 0, 100);
  const repConsistencyScore = clamp(tempoConsistencyScore * 0.65 + romScore * 0.35, 0, 100);

  return Math.round(clamp(
    romScore * 0.4 +
    tempoVelocityScore * 0.25 +
    tremorScorePart * 0.2 +
    repConsistencyScore * 0.15,
    0,
    100,
  ));
}

function classifyCleanReps(repMetrics, referenceMetrics = [], mode = "free_movement", sensorQuality = { status: "good" }) {
  const reference = {
    amplitude: average(referenceMetrics.map((rep) => rep.amplitudeProxy).filter(Boolean)),
    duration: average(referenceMetrics.map((rep) => rep.durationMs).filter(Boolean)),
    tremor: average(referenceMetrics.map((rep) => rep.tremorScore).filter(Number.isFinite)),
    smoothness: average(referenceMetrics.map((rep) => rep.smoothnessScore).filter(Number.isFinite)),
    stability: average(referenceMetrics.map((rep) => rep.gyroStabilityScore).filter(Number.isFinite)),
  };
  const first = {
    amplitude: average(repMetrics.slice(0, 3).map((rep) => rep.amplitudeProxy).filter(Boolean)),
    duration: average(repMetrics.slice(0, 3).map((rep) => rep.durationMs).filter(Boolean)),
    tremor: average(repMetrics.slice(0, 3).map((rep) => rep.tremorScore).filter(Number.isFinite)),
    smoothness: average(repMetrics.slice(0, 3).map((rep) => rep.smoothnessScore).filter(Number.isFinite)),
    stability: average(repMetrics.slice(0, 3).map((rep) => rep.gyroStabilityScore).filter(Number.isFinite)),
  };
  const robust = {
    amplitude: percentile(repMetrics.map((rep) => rep.amplitudeProxy).filter(Boolean), 0.5),
    duration: percentile(repMetrics.map((rep) => rep.durationMs).filter(Boolean), 0.5),
    tremor: percentile(repMetrics.map((rep) => rep.tremorScore).filter(Number.isFinite), 0.5),
    smoothness: percentile(repMetrics.map((rep) => rep.smoothnessScore).filter(Number.isFinite), 0.5),
    stability: percentile(repMetrics.map((rep) => rep.gyroStabilityScore).filter(Number.isFinite), 0.5),
  };
  const hasReference = referenceMetrics.length >= 3;
  const basis = {
    amplitude: hasReference ? reference.amplitude : robust.amplitude || first.amplitude,
    duration: hasReference ? reference.duration : robust.duration || first.duration,
    tremor: hasReference ? reference.tremor : robust.tremor || first.tremor,
    smoothness: hasReference ? reference.smoothness : robust.smoothness || first.smoothness,
    stability: hasReference ? reference.stability : robust.stability || first.stability,
  };
  const counts = { clean: 0, warning: 0, bad: 0, uncertain: 0 };
  const issueCounts = new Map();
  let firstBadRep = null;
  repMetrics.forEach((rep) => {
    const reasons = [];
    if (basis.amplitude && rep.amplitudeProxy < basis.amplitude * 0.85) reasons.push("ROM");
    if (basis.duration && (rep.durationMs > basis.duration * 1.2 || rep.velocityLossPercent > 20)) reasons.push("Tempo");
    if (basis.tremor && rep.tremorScore > basis.tremor * 1.3) reasons.push("Ruckeln");
    if (basis.smoothness && rep.smoothnessScore < basis.smoothness * 0.8) reasons.push("Smoothness");
    if (mode !== "weight_stack" && basis.stability && rep.gyroStabilityScore < basis.stability * 0.7) reasons.push("Stabilität");
    if (mode === "weight_stack" && rep.qualityFlags) {
      if (rep.qualityFlags.partialRep) reasons.push("ROM");
      if (rep.qualityFlags.tooFastDown) reasons.push("Tempo/Kontrolle");
      if (rep.qualityFlags.droppedWeight) reasons.push("Gewicht kontrolliert ablassen");
      if (rep.qualityFlags.jerky) reasons.push("Ruckeln");
    }
    if (sensorQuality.status !== "good") reasons.push("Messung unsicher");

    if (sensorQuality.status !== "good" && reasons.length <= 1) rep.qualityClass = "uncertain";
    else if (reasons.length >= 3) rep.qualityClass = "bad";
    else if (reasons.length >= 1) rep.qualityClass = "warning";
    else rep.qualityClass = "clean";
    rep.qualityReasons = reasons;
    counts[rep.qualityClass] += 1;
    if ((rep.qualityClass === "bad" || rep.qualityClass === "uncertain") && firstBadRep === null) firstBadRep = rep.repNumber;
    reasons.forEach((reason) => issueCounts.set(reason, (issueCounts.get(reason) || 0) + 1));
  });
  const mainIssue = [...issueCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const velocityLossPercent = Math.max(0, ...repMetrics.map((rep) => rep.velocityLossPercent || 0));
  return { ...counts, firstBadRep, mainIssue, velocityLossPercent };
}

function detectFatigue(repMetrics, referenceRepMetrics = [], mode = "free_movement") {
  const result = { fatigueDetected: false, fatigueStartRep: null, fatigueReasons: [], fatigueScore: 0 };
  if (!repMetrics.length) return result;
  const baselineReps = repMetrics.slice(0, Math.min(3, repMetrics.length));
  const referenceBaseline = referenceRepMetrics.slice(0, Math.min(3, referenceRepMetrics.length));
  const pool = [...baselineReps, ...referenceBaseline];
  const baseline = {
    durationMs: average(pool.map((rep) => rep.durationMs).filter(Boolean)),
    amplitudeProxy: average(pool.map((rep) => rep.amplitudeProxy).filter(Boolean)),
    tremorScore: average(pool.map((rep) => rep.tremorScore).filter(Number.isFinite)),
    smoothnessScore: average(pool.map((rep) => rep.smoothnessScore).filter(Number.isFinite)),
    gyroStabilityScore: average(pool.map((rep) => rep.gyroStabilityScore).filter(Number.isFinite)),
    velocityProxy: average(pool.map((rep) => rep.velocityProxy).filter(Number.isFinite)),
  };
  for (const rep of repMetrics) {
    const reasons = [];
    if (baseline.durationMs && rep.durationMs > baseline.durationMs * 1.2) reasons.push("Rep-Dauer steigt deutlich");
    if (baseline.amplitudeProxy && rep.amplitudeProxy < baseline.amplitudeProxy * 0.85) reasons.push("Amplitude/ROMProxy sinkt");
    if (baseline.tremorScore && rep.tremorScore > baseline.tremorScore * 1.3) reasons.push("Tremor/Ruckeln steigt");
    if (baseline.smoothnessScore && rep.smoothnessScore < baseline.smoothnessScore * 0.8) reasons.push("Smoothness sinkt");
    if (mode !== "weight_stack" && baseline.gyroStabilityScore && rep.gyroStabilityScore < baseline.gyroStabilityScore * 0.7) reasons.push("Gyro-Stabilität verschlechtert sich");
    if (baseline.velocityProxy && rep.velocityProxy < baseline.velocityProxy * 0.8) reasons.push("VelocityProxy sinkt");
    if (reasons.length >= 2) {
      return {
        fatigueDetected: true,
        fatigueStartRep: rep.repNumber,
        fatigueReasons: reasons,
        fatigueScore: Math.round(clamp(reasons.length * 20 + (rep.repNumber / Math.max(repMetrics.length, 1)) * 20, 0, 100)),
      };
    }
  }
  return result;
}

function compareRecordingToReference(currentRecording, referenceRecording, exercise = getSelectedExercise()) {
  return compareToReferenceByMode(currentRecording, referenceRecording, exercise);
}

function compareToReferenceByMode(currentRecording, referenceRecording, exercise = getSelectedExercise()) {
  const currentMetrics = currentRecording.metrics || analyzeRecordingByMode(currentRecording.rawSamples, exercise);
  const referenceMetrics = referenceRecording.metrics || analyzeRecordingByMode(referenceRecording.rawSamples, exercise);
  const mode = normalizeAnalysisMode(exercise?.analysisMode);
  const tooLittleData = currentRecording.rawSamples.length < MIN_ANALYSIS_SAMPLES || referenceRecording.rawSamples.length < MIN_ANALYSIS_SAMPLES;
  const primaryCurveScore = errorToScore(normalizedCurveRmseValues(currentMetrics.signals.primary, referenceMetrics.signals.primary));
  const secondaryCurveScore = errorToScore(normalizedCurveRmseValues(currentMetrics.signals.secondary, referenceMetrics.signals.secondary));
  const relativeRangeOfMotion = referenceMetrics.amplitudeEstimate
    ? clamp((currentMetrics.amplitudeEstimate / referenceMetrics.amplitudeEstimate) * 100, 0, 200)
    : null;
  currentMetrics.relativeRangeOfMotion = relativeRangeOfMotion;
  const scores = {
    rep: percentSimilarity(currentMetrics.reps, referenceMetrics.reps),
    duration: percentSimilarity(currentMetrics.avgRepDurationMs, referenceMetrics.avgRepDurationMs),
    amplitude: percentSimilarity(currentMetrics.amplitudeEstimate, referenceMetrics.amplitudeEstimate),
    smoothness: percentSimilarity(currentMetrics.smoothnessScore, referenceMetrics.smoothnessScore),
    stability: percentSimilarity(currentMetrics.stabilityScore, referenceMetrics.stabilityScore),
    tremor: percentSimilarity(currentMetrics.tremorScore, referenceMetrics.tremorScore),
  };
  let overallScore;
  if (mode === "weight_stack") {
    const romScore = scores.amplitude;
    const velocityScore = clamp(100 - Math.max(0, currentMetrics.velocityLossPercent || 0) * 2, 0, 100);
    const tempoVelocityScore = clamp(scores.duration * 0.45 + velocityScore * 0.55, 0, 100);
    const tremorScorePart = clamp(100 - Math.max(0, comparisonSafePercentDifference(currentMetrics.tremorScore, referenceMetrics.tremorScore)) * 1.8, 0, 100);
    const repConsistencyScore = clamp(scores.rep * 0.35 + currentMetrics.tempoConsistencyScore * 0.4 + scores.amplitude * 0.25, 0, 100);
    overallScore = Math.round(clamp(
      romScore * 0.4 +
      tempoVelocityScore * 0.25 +
      tremorScorePart * 0.2 +
      repConsistencyScore * 0.15,
      0,
      100,
    ));
  } else {
  const weights = {
    weight_stack: [0.38, 0.06, 0.12, 0.14, 0.14, 0.1, 0.03, 0.03],
    barbell: [0.24, 0.22, 0.1, 0.12, 0.12, 0.07, 0.1, 0.03],
    cable_handle: [0.28, 0.22, 0.1, 0.12, 0.1, 0.08, 0.07, 0.03],
    free_movement: [0.3, 0.12, 0.12, 0.14, 0.12, 0.1, 0.05, 0.05],
    body_segment: [0.3, 0.12, 0.12, 0.14, 0.12, 0.1, 0.05, 0.05],
  }[mode] || [0.3, 0.12, 0.12, 0.14, 0.12, 0.1, 0.05, 0.05];
  overallScore = Math.round(primaryCurveScore * weights[0] + secondaryCurveScore * weights[1] + scores.rep * weights[2] + scores.duration * weights[3] + scores.amplitude * weights[4] + scores.smoothness * weights[5] + scores.stability * weights[6] + scores.tremor * weights[7]);
  }
  if (tooLittleData) overallScore = Math.min(overallScore, 35);
  const comparison = {
    overallScore,
    repCountDiff: currentMetrics.reps - referenceMetrics.reps,
    durationDiffPercent: percentDifference(currentMetrics.durationMs, referenceMetrics.durationMs),
    avgRepDurationDiffPercent: percentDifference(currentMetrics.avgRepDurationMs, referenceMetrics.avgRepDurationMs),
    amplitudeDiffPercent: percentDifference(currentMetrics.amplitudeEstimate, referenceMetrics.amplitudeEstimate),
    smoothnessDiffPercent: percentDifference(currentMetrics.smoothnessScore, referenceMetrics.smoothnessScore),
    tremorDiffPercent: percentDifference(currentMetrics.tremorScore, referenceMetrics.tremorScore),
    stabilityDiffPercent: percentDifference(currentMetrics.stabilityScore, referenceMetrics.stabilityScore),
    relativeRangeOfMotion,
    primaryCurveScore,
    secondaryCurveScore,
    feedbackEvents: currentMetrics.feedbackEvents || [],
  };
  comparison.feedbackMessages = buildFeedbackMessages(currentMetrics, comparison, exercise);
  if (tooLittleData) comparison.feedbackMessages.unshift("Datenmenge zu gering für eine belastbare Analyse.");
  currentMetrics.recommendation = generateTrainingRecommendation(currentMetrics, comparison, exercise);
  comparison.feedbackEvents = buildFeedbackEvents(currentMetrics, comparison);
  return comparison;
}

function buildFeedbackMessages(analysis, comparison, exercise = getSelectedExercise()) {
  const mode = normalizeAnalysisMode(exercise?.analysisMode);
  const messages = [];
  if (comparison.overallScore >= 82) messages.push("Bewegung sehr ähnlich zur Referenz.");
  else if (comparison.overallScore >= 65) messages.push("Ausführung insgesamt nah an der Referenz.");
  else messages.push("Ausführung weicht deutlich von der Referenz ab.");
  if (analysis.sensorQuality?.status !== "good") messages.push(`Messung unsicher: ${analysis.sensorQuality.issues.join(", ")}`);
  if (comparison.avgRepDurationDiffPercent < -15) messages.push("Tempo deutlich schneller als Referenz.");
  if (comparison.avgRepDurationDiffPercent > 18) messages.push("Tempo deutlich langsamer als Referenz.");
  if (comparison.amplitudeDiffPercent < -15) messages.push("Range of Motion wirkt verkürzt im Vergleich zur Referenz.");
  else if (comparison.relativeRangeOfMotion !== null && comparison.relativeRangeOfMotion >= 90 && comparison.relativeRangeOfMotion <= 110) messages.push("Bewegungsumfang ähnlich zur Referenz.");
  if (comparison.smoothnessDiffPercent < -20) messages.push("Bewegung ist ruckartiger als in der Referenz.");
  if (comparison.tremorDiffPercent > 30) messages.push("Ruckeln/Zittern im Bewegungssignal nimmt zu.");
  if (analysis.fatigue?.fatigueDetected) messages.push(`Saubere Bewegung bis Rep ${Math.max(1, analysis.fatigue.fatigueStartRep - 1)}, danach zunehmende Ermüdung.`);
  if (mode === "weight_stack" && analysis.sensorQuality?.issues?.some((issue) => issue.includes("Gyro"))) {
    messages.push("Sensor sitzt möglicherweise locker / Messung unsicher.");
  }
  if (mode === "barbell" && comparison.stabilityDiffPercent < -20) messages.push("Stangenrotation höher als in der Referenz. Möglicher Hinweis auf asymmetrische Belastung.");
  if (mode === "cable_handle" && comparison.stabilityDiffPercent < -20) messages.push("Griffrotation höher als Referenz.");
  if (mode === "body_segment") messages.push("Körpersegment-Modus ist als Future Mode sichtbar, aber noch generisch ausgewertet.");
  return [...new Set(messages)];
}

function generateTrainingRecommendation(analysis, comparison = null, exercise = getSelectedExercise()) {
  const total = Math.max(analysis.reps || 0, 1);
  const cleanRatio = (analysis.cleanRepCount || 0) / total;
  const badRatio = ((analysis.badRepCount || 0) + (analysis.uncertainRepCount || 0)) / total;
  const velocityLoss = analysis.velocityLossPercent || 0;
  const rom = comparison?.relativeRangeOfMotion ?? analysis.relativeRangeOfMotion;
  const hasEarlyFatigue = analysis.fatigue?.fatigueDetected && analysis.fatigue.fatigueStartRep <= Math.max(3, Math.ceil(total * 0.5));
  const sensorUncertain = analysis.sensorQuality?.status !== "good";
  const reasons = [];

  if (sensorUncertain) {
    reasons.push("Messung unsicher");
    return {
      action: "technique_focus",
      label: "Technikfokus",
      message: "Technikfokus: Sensor/Signal zuerst stabilisieren, dann Satz erneut bewerten.",
      reasons,
    };
  }

  if (cleanRatio >= 0.9 && !analysis.fatigue?.fatigueDetected && velocityLoss < 15 && (!rom || rom >= 92)) {
    reasons.push("fast alle Reps sauber", "kaum Ermüdung", "ROM stabil");
    return {
      action: "increase_weight",
      label: "Gewicht erhöhen",
      message: `Gewicht erhöhen: nächster Satz ${exercise?.targetReps || "Ziel"} Reps mit kleiner Steigerung möglich.`,
      reasons,
    };
  }

  if (hasEarlyFatigue || badRatio >= 0.35 || velocityLoss > 35 || (rom && rom < 85)) {
    if (hasEarlyFatigue) reasons.push(`frühe Ermüdung ab Rep ${analysis.fatigue.fatigueStartRep}`);
    if (badRatio >= 0.35) reasons.push("viele schlechte/unsichere Reps");
    if (velocityLoss > 35) reasons.push("hoher Tempoverlust");
    if (rom && rom < 85) reasons.push("ROM deutlich reduziert");
    return {
      action: "reduce_weight",
      label: "Gewicht reduzieren",
      message: "Gewicht reduzieren: Bewegung zuerst stabil und mit voller ROM ausführen.",
      reasons,
    };
  }

  if ((analysis.warningRepCount || 0) > 0 || analysis.fatigue?.fatigueDetected || velocityLoss >= 18) {
    if (analysis.fatigue?.fatigueDetected) reasons.push(`Ermüdung ab Rep ${analysis.fatigue.fatigueStartRep}`);
    if (velocityLoss >= 18) reasons.push("moderater Tempoverlust");
    if (analysis.mainIssue && analysis.mainIssue !== "—") reasons.push(`Hauptthema: ${analysis.mainIssue}`);
    return {
      action: "hold_weight",
      label: "Gewicht halten",
      message: `Gewicht halten: nächster Satz ${exercise?.targetReps ? `${exercise.targetReps} Reps` : "im Zielbereich"}, Fokus ${analysis.mainIssue && analysis.mainIssue !== "—" ? analysis.mainIssue : "saubere Ausführung"}.`,
      reasons,
    };
  }

  return {
    action: "hold_weight",
    label: "Gewicht halten",
    message: "Gewicht halten: Satz größtenteils sauber, Qualität weiter bestätigen.",
    reasons: ["Satz größtenteils sauber"],
  };
}

function buildFeedbackEvents(analysis, comparison = null) {
  const repMetrics = analysis.repMetrics || [];
  const fatigue = analysis.fatigue || {};
  const events = [];
  if (fatigue.fatigueDetected) events.push({ type: "fatigue_start", rep: fatigue.fatigueStartRep });
  const firstGroup = repMetrics.slice(0, Math.min(3, repMetrics.length));
  const baselineTremor = average(firstGroup.map((rep) => rep.tremorScore));
  const baselineAmplitude = average(firstGroup.map((rep) => rep.amplitudeProxy));
  repMetrics.forEach((rep) => {
    if (baselineAmplitude && rep.amplitudeProxy < baselineAmplitude * 0.85) events.push({ type: "rom_low", rep: rep.repNumber });
    if (rep.velocityLossPercent > 20) events.push({ type: "tempo_fast", rep: rep.repNumber });
    if (baselineTremor && rep.tremorScore > baselineTremor * 1.3) events.push({ type: "tremor_high", rep: rep.repNumber });
    if (rep.maxTiltProxy > 45) events.push({ type: "bar_tilt", rep: rep.repNumber });
  });
  if (analysis.sensorQuality?.status !== "good") events.push({ type: "sensor_uncertain", rep: null });
  if (comparison?.relativeRangeOfMotion && comparison.relativeRangeOfMotion < 85) events.push({ type: "rom_low", rep: null });
  return events;
}

function buildMetricEvents(repMetrics, fatigue, mode) {
  return buildFeedbackEvents({ repMetrics, fatigue, analysisMode: mode }, null);
}

function speakFeedback(text) {
  if (!audioFeedbackEnabled || !text || !("speechSynthesis" in window)) return;
  const now = Date.now();
  const delay = Math.max(0, audioCooldownMs - (now - lastAudioAt));
  window.setTimeout(() => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      utterance.rate = 1.02;
      utterance.pitch = 0.92;
      speechSynthesis.speak(utterance);
      lastAudioAt = Date.now();
    } catch (error) {
      console.warn("Audiofeedback konnte nicht gesprochen werden.", error);
    }
  }, delay);
}

function queueAudioCue(event) {
  if (!audioFeedbackEnabled || !event?.message || !("speechSynthesis" in window)) return;
  if (recordingMode === "reference" && event.type !== "reference_end") return;
  const limit = event.type === "set_summary" ? 1 : 2;
  const currentCount = audioEventCounts[event.type] || 0;
  if (currentCount >= limit) return;
  audioEventCounts[event.type] = currentCount + 1;
  audioQueue.push({
    type: event.type,
    repIndex: event.repIndex ?? null,
    message: event.message,
    priority: event.priority ?? 5,
    spoken: false,
  });
  audioQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  processAudioQueue();
}

function processAudioQueue() {
  if (audioProcessing || !audioFeedbackEnabled || !audioQueue.length) return;
  const next = audioQueue.shift();
  if (!next || next.spoken) return;
  audioProcessing = true;
  speakFeedback(next.message);
  next.spoken = true;
  window.setTimeout(() => {
    audioProcessing = false;
    processAudioQueue();
  }, audioCooldownMs);
}

function buildAudioCueForRep(repMetric, analysis = {}) {
  if (!repMetric) return null;
  if (analysis.fatigue?.fatigueDetected && repMetric.repNumber === analysis.fatigue.fatigueStartRep) {
    return {
      type: "fatigue_start",
      repIndex: repMetric.repNumber,
      message: `Ermüdung ab Wiederholung ${repMetric.repNumber}`,
      priority: 9,
    };
  }
  if (repMetric.romPercent !== null && repMetric.romPercent < 85) {
    return {
      type: "rom_low",
      repIndex: repMetric.repNumber,
      message: "Bewegungsumfang wird kürzer",
      priority: 8,
    };
  }
  if ((repMetric.velocityLossPercent || 0) > 25 || repMetric.durationMs > 0 && repMetric.feedbackText === "Tempo fällt ab") {
    return {
      type: "tempo_loss",
      repIndex: repMetric.repNumber,
      message: "Tempo kontrollieren",
      priority: 7,
    };
  }
  if (repMetric.tremorLevel === "high") {
    return {
      type: "tremor_high",
      repIndex: repMetric.repNumber,
      message: "Bewegung wird unruhig",
      priority: 7,
    };
  }
  if (repMetric.qualityClass === "bad") {
    return {
      type: "set_stop_suggestion",
      repIndex: repMetric.repNumber,
      message: "Satz besser beenden",
      priority: 6,
    };
  }
  return null;
}

function buildSetSummaryAudio(analysis) {
  if (!analysis) return "";
  const reps = analysis.reps || 0;
  const clean = analysis.cleanRepCount || 0;
  const recommendation = analysis.recommendation?.label || "Gewicht halten";
  return `${reps} Wiederholungen erkannt, ${clean} sauber. Empfehlung: ${recommendation}.`;
}

function queueLiveRepAudio(analysis) {
  if (!audioFeedbackEnabled || !recording || recordingMode !== "set") return;
  if (analysis.sensorQuality?.issues?.some((issue) => issue.includes("Gyro"))) {
    queueAudioCue({
      type: "sensor_uncertain",
      message: "Sensor sitzt möglicherweise locker, Messung unsicher",
      priority: 8,
    });
  }
  const repMetrics = analysis.repMetrics || [];
  if (repMetrics.length <= lastAudioRepCount) return;
  repMetrics.slice(lastAudioRepCount).forEach((rep) => {
    const cue = buildAudioCueForRep(rep, analysis);
    if (cue?.type !== "rep_clean_optional") queueAudioCue(cue);
  });
  lastAudioRepCount = repMetrics.length;
}

function normalizedCurveRmseValues(currentValues, referenceValues) {
  if (!currentValues?.length || !referenceValues?.length) return 2;
  const current = resampleValues(currentValues, OVERLAY_POINT_COUNT);
  const reference = resampleValues(referenceValues, OVERLAY_POINT_COUNT);
  const scale = Math.max(percentile(reference, 0.95) - percentile(reference, 0.05), standardDeviation(reference), Math.abs(average(reference)) * 0.08, 0.01);
  return Math.sqrt(average(current.map((value, index) => (value - reference[index]) ** 2))) / scale;
}

function estimateBarbellTiltProxy(correctedSamples) {
  let roll = 0;
  let pitch = 0;
  let yaw = 0;
  const values = [0];
  for (let index = 1; index < correctedSamples.length; index += 1) {
    const previous = correctedSamples[index - 1];
    const sample = correctedSamples[index];
    const deltaSeconds = Math.max((sample.timestamp - previous.timestamp) / 1000, 0.001);
    roll += sample.gx * deltaSeconds;
    pitch += sample.gy * deltaSeconds;
    yaw += sample.gz * deltaSeconds;
    const accRoll = Math.atan2(sample.ay, sample.az || 0.0001) * 180 / Math.PI;
    const accPitch = Math.atan2(-sample.ax, Math.hypot(sample.ay, sample.az) || 0.0001) * 180 / Math.PI;
    roll = roll * 0.98 + accRoll * 0.02;
    pitch = pitch * 0.98 + accPitch * 0.02;
    values.push(Math.hypot(roll, pitch, yaw * 0.45));
  }
  return movingAverage(values, 5);
}

function estimateIntervalFromTimestamps(timestamps) {
  const intervals = [];
  for (let index = 1; index < Math.min(timestamps.length, 101); index += 1) {
    const interval = timestamps[index] - timestamps[index - 1];
    if (interval > 0 && interval < 1000) intervals.push(interval);
  }
  return intervals.length ? percentile(intervals, 0.5) : 50;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function standardDeviation(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  const mean = average(valid);
  return Math.sqrt(average(valid.map((value) => (value - mean) ** 2)));
}

function resampleProperty(data, property, targetLength) {
  return resampleValues(data.map((sample) => Number(sample[property]) || 0), targetLength);
}

function resampleValues(values, targetLength) {
  if (!values.length || targetLength <= 0) return [];
  if (values.length === 1) return new Array(targetLength).fill(Number(values[0]) || 0);
  const result = [];
  for (let index = 0; index < targetLength; index += 1) {
    const position = (index * (values.length - 1)) / Math.max(targetLength - 1, 1);
    const lower = Math.floor(position);
    const upper = Math.min(values.length - 1, Math.ceil(position));
    const weight = position - lower;
    result.push((Number(values[lower]) || 0) * (1 - weight) + (Number(values[upper]) || 0) * weight);
  }
  return result;
}

function openExerciseForm(exercise = null) {
  editingExerciseId = exercise?.id || null;
  elements.exerciseFormTitle.textContent = exercise ? "Übung bearbeiten" : "Neue Übung";
  elements.exerciseId.value = exercise?.id || "";
  elements.exerciseName.value = exercise?.name || "";
  elements.equipmentType.value = exercise?.equipmentType || "Geführte Maschine";
  elements.muscleGroup.value = exercise?.muscleGroup || "";
  elements.exerciseWeight.value = exercise?.weight || "";
  elements.targetReps.value = exercise?.targetReps || "";
  elements.setType.value = normalizeSetType(exercise?.setType);
  elements.sensorPosition.value = exercise?.sensorPosition || "";
  elements.analysisMode.value = normalizeAnalysisMode(exercise?.analysisMode, exercise?.equipmentType);
  elements.exerciseNotes.value = exercise?.notes || "";
  elements.exerciseForm.hidden = false;
  elements.exerciseName.focus();
}

function closeExerciseForm() {
  editingExerciseId = null;
  elements.exerciseForm.reset();
  elements.exerciseForm.hidden = true;
}

function handleExerciseSubmit(event) {
  event.preventDefault();
  const name = elements.exerciseName.value.trim();
  if (!name) {
    showMessage("Bitte gib einen Übungsnamen ein.");
    return;
  }

  const values = {
    name,
    equipmentType: elements.equipmentType.value.trim(),
    muscleGroup: elements.muscleGroup.value.trim(),
    weight: elements.exerciseWeight.value.trim(),
    targetReps: Number(elements.targetReps.value) || "",
    setType: normalizeSetType(elements.setType.value),
    sensorPosition: elements.sensorPosition.value.trim(),
    analysisMode: normalizeAnalysisMode(elements.analysisMode.value),
    notes: elements.exerciseNotes.value.trim(),
  };

  if (editingExerciseId) {
    const exercise = getExerciseById(editingExerciseId);
    if (exercise) {
      Object.assign(exercise, values);
      reanalyzeExerciseRecordings(exercise);
    }
  } else {
    const exercise = {
      id: createId(),
      ...values,
      calibrationProfile: null,
      referenceRecording: null,
      setRecordings: [],
    };
    appState.exercises.push(exercise);
    appState.selectedExerciseId = exercise.id;
    selectedExportExerciseId = exercise.id;
    resetAnalysisSelection(exercise);
  }

  saveState();
  closeExerciseForm();
  showMessage("Übung gespeichert.", "success");
  renderAll();
}

function reanalyzeExerciseRecordings(exercise) {
  if (!exercise) return;
  if (exercise.referenceRecording) {
    exercise.referenceRecording.metrics = analyzeRecordingByMode(exercise.referenceRecording.rawSamples, exercise);
  }
  exercise.setRecordings.forEach((setRecording) => {
    setRecording.metrics = analyzeRecordingByMode(setRecording.rawSamples, exercise);
    if (exercise.referenceRecording) {
      setRecording.comparison = compareRecordingToReference(setRecording, exercise.referenceRecording, exercise);
      setRecording.metrics.movementQualityScore = setRecording.comparison.overallScore;
    }
  });
}

function addSetToSession(exercise, recordingData) {
  if (!Array.isArray(appState.sessions)) appState.sessions = [];
  const dateKey = new Date(recordingData.createdAt).toISOString().slice(0, 10);
  let session = appState.sessions.find((item) => item.date.slice(0, 10) === dateKey);
  if (!session) {
    session = { id: createId(), date: new Date(recordingData.createdAt).toISOString(), sets: [] };
    appState.sessions.push(session);
  }
  session.sets.push({
    recordingId: recordingData.id,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    weight: exercise.weight,
    reps: recordingData.metrics.reps,
    cleanReps: recordingData.metrics.cleanRepCount,
    qualityScore: recordingData.comparison?.overallScore ?? recordingData.metrics.movementQualityScore,
    recommendation: recordingData.metrics.recommendation?.action || "hold_weight",
    createdAt: recordingData.createdAt,
  });
}

function selectExercise(id) {
  if (!getExerciseById(id)) return;
  appState.selectedExerciseId = id;
  selectedExportExerciseId = id;
  resetAnalysisSelection(getExerciseById(id));
  saveState();
  renderAll();
}

function deleteExercise(id) {
  const exercise = getExerciseById(id);
  if (!exercise) return;
  if (!window.confirm(`„${exercise.name}“ inklusive Referenz und aller Sätze löschen?`)) return;

  appState.exercises = appState.exercises.filter((item) => item.id !== id);
  if (appState.selectedExerciseId === id) {
    appState.selectedExerciseId = appState.exercises[0]?.id || null;
  }
  selectedExportExerciseId = appState.selectedExerciseId;
  resetAnalysisSelection(getSelectedExercise());
  saveState();
  renderAll();
}

function deleteSetRecording(exerciseId, recordingId) {
  const exercise = getExerciseById(exerciseId);
  const recordingData = getRecordingById(exercise, recordingId);
  if (!exercise || !recordingData || recordingData.type === "reference") return;
  if (!window.confirm(`${recordingData.name} dauerhaft löschen?`)) return;
  exercise.setRecordings = exercise.setRecordings.filter((item) => item.id !== recordingId);
  selectedAnalysisRecordingIds.delete(recordingId);
  saveState();
  renderAll();
}

// ---------------------------------------------------------------------------
// Import und Export
// ---------------------------------------------------------------------------

function downloadCsv(data = samples, fileName = "gymimu-recording.csv") {
  if (!data?.length) {
    showMessage("Keine Aufnahmedaten für den CSV-Export vorhanden.");
    return;
  }
  const header = "timestamp_ms,ax,ay,az,gx,gy,gz,distanceMm,accMagnitude,gyroMagnitude";
  const rows = data.map((sample) =>
    [
      sample.timestamp,
      sample.ax,
      sample.ay,
      sample.az,
      sample.gx,
      sample.gy,
      sample.gz,
      sample.distanceMm ?? "",
      sample.accMagnitude,
      sample.gyroMagnitude,
    ].join(","),
  );
  downloadBlob(`${header}\n${rows.join("\n")}\n`, "text/csv;charset=utf-8", fileName);
}

function exportAllData() {
  downloadJson(appState, `gymimu-backup-${fileDate()}.json`);
}

function exportSelectedExercise() {
  const exercise = getExerciseById(selectedExportExerciseId);
  if (!exercise) {
    showMessage("Keine Übung für den Export ausgewählt.");
    return;
  }
  downloadJson(
    { version: 1, exportedAt: new Date().toISOString(), exercise },
    `gymimu-${slugify(exercise.name)}-${fileDate()}.json`,
  );
}

function downloadCurrentRecordingCsv() {
  const data = pendingRecording?.rawSamples || samples;
  downloadCsv(data, `gymimu-aktuelle-aufnahme-${fileDate()}.csv`);
}

function downloadSavedRecordingCsv() {
  const exercise = getExerciseById(selectedExportExerciseId);
  const recordingData = getRecordingById(exercise, elements.exportRecordingSelect.value);
  if (!recordingData) {
    showMessage("Keine gespeicherte Aufnahme ausgewählt.");
    return;
  }
  downloadCsv(
    recordingData.rawSamples,
    `gymimu-${slugify(exercise.name)}-${slugify(recordingData.name)}-${fileDate()}.csv`,
  );
}

async function importAllData(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const normalized = normalizeImportedState(parsed);
    if (!window.confirm("Importieren und alle aktuell lokalen GymIMU-Daten ersetzen?")) return;
    appState = normalized;
    selectedExportExerciseId = appState.selectedExerciseId;
    resetAnalysisSelection(getSelectedExercise());
    saveState();
    discardRecording();
    showMessage("JSON-Daten wurden erfolgreich importiert.", "success");
    renderAll();
  } catch (error) {
    showMessage(`Import fehlgeschlagen: ${friendlyError(error)}`, "error", true);
  } finally {
    elements.importFileInput.value = "";
  }
}

function deleteAllData() {
  if (!window.confirm("Wirklich alle Übungen, Referenzen und Sätze in diesem Browser löschen?")) return;
  localStorage.removeItem(STORAGE_KEY);
  appState = { version: 1, selectedExerciseId: null, sessions: [], exercises: [] };
  selectedExportExerciseId = null;
  selectedAnalysisRecordingIds.clear();
  discardRecording();
  showMessage("Alle lokalen GymIMU-Daten wurden gelöscht.", "success");
  renderAll();
}

function downloadJson(value, fileName) {
  downloadBlob(JSON.stringify(value, null, 2), "application/json;charset=utf-8", fileName);
}

function downloadBlob(content, type, fileName) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function fileDate() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "aufnahme";
}

// ---------------------------------------------------------------------------
// UI-Rendering
// ---------------------------------------------------------------------------

function renderAll() {
  renderConnectionState();
  renderDashboard();
  renderExercises();
  renderExerciseSelects();
  renderRecordingState();
  renderAnalysis();
  renderExportControls();
  requestAnimationFrame(() => {
    drawCharts();
    drawAnalysisCharts();
  });
}

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
  if (tabName === "analysis") {
    requestAnimationFrame(drawAnalysisCharts);
  }
  if (tabName === "recording") {
    requestAnimationFrame(drawCharts);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderConnectionState() {
  if (isBluetoothConnected()) {
    setConnectionStatus(`Verbunden: ${bluetoothDevice.name || "GymIMU"}`, "online");
  } else if (elements.connectionStatus.textContent !== "Verbindung getrennt") {
    setConnectionStatus("Nicht verbunden", "offline");
  }

  if (isDemoActive()) {
    setDemoStatus(`${demoProfileLabel(elements.demoProfile.value)} aktiv`, "demo");
    elements.demoButton.textContent = "Demo-Modus stoppen";
  } else {
    setDemoStatus("Demo aus", "offline");
    elements.demoButton.textContent = "Demo-Modus starten";
  }
}

function renderDashboard() {
  const exercise = getSelectedExercise();
  const lastSet = exercise?.setRecordings.at(-1) || null;
  const cards = [
    ["BLE", isBluetoothConnected() ? "Verbunden" : "Nicht verbunden"],
    ["Demo", isDemoActive() ? "Aktiv" : "Inaktiv"],
    ["Analysemodus", exercise ? analysisModeLabel(exercise.analysisMode) : "—"],
    ["Übung", exercise?.name || "Keine ausgewählt"],
    ["Referenz", exercise?.referenceRecording ? "Vorhanden" : "Fehlt"],
    ["Gespeicherte Sätze", String(exercise?.setRecordings.length || 0)],
    ["Kalibrierung", exercise?.calibrationProfile ? "Gespeichert" : "Fehlt"],
  ];
  elements.dashboardCards.innerHTML = cards
    .map(([label, value]) => `<article class="dashboard-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`)
    .join("");

  if (!lastSet) {
    elements.lastSetTitle.textContent = "Noch kein Satz gespeichert";
    elements.lastSetScore.textContent = "—";
    elements.lastSetScore.className = "score score-neutral";
    elements.lastSetContent.className = "empty-state";
    elements.lastSetContent.textContent = exercise
      ? "Nimm einen Trainingssatz auf, um hier die letzte Bewertung zu sehen."
      : "Lege zuerst eine Übung an.";
    return;
  }

  const score = lastSet.comparison?.overallScore ?? lastSet.metrics.movementQualityScore;
  elements.lastSetTitle.textContent = `${lastSet.name} · ${formatDate(lastSet.createdAt)}`;
  elements.lastSetScore.textContent = `${Math.round(score)} %`;
  elements.lastSetScore.className = `score ${scoreClass(score)}`;
  elements.lastSetContent.className = "";
  elements.lastSetContent.innerHTML = `
    <div class="result-grid">
      ${metricResult("Reps", lastSet.metrics.reps)}
      ${metricResult("Dauer", formatDuration(lastSet.durationMs))}
      ${metricResult("Ø Rep", formatMilliseconds(lastSet.metrics.avgRepDurationMs))}
      ${metricResult("ROM", formatRomMetric(lastSet.metrics, lastSet.comparison))}
      ${metricResult("Tremor", formatNumber(lastSet.metrics.tremorScore, 2))}
      ${metricResult("Bewertung", scoreLabel(score))}
    </div>
    <p class="muted">${escapeHtml(lastSet.comparison?.feedbackMessages?.[0] || "Satz lokal analysiert.")}</p>
  `;
}

function renderExercises() {
  if (appState.exercises.length === 0) {
    elements.exerciseList.innerHTML = `
      <article class="panel empty-state">
        Noch keine Übung vorhanden. Lege deine erste Übung an, bevor du eine Aufnahme startest.
      </article>
    `;
    return;
  }

  elements.exerciseList.innerHTML = appState.exercises.map((exercise) => {
    const selected = exercise.id === appState.selectedExerciseId;
    return `
      <article class="exercise-card ${selected ? "selected" : ""}">
        <div>
          <div class="section-heading">
            <h3>${escapeHtml(exercise.name)}</h3>
            ${selected ? '<span class="status status-online">Ausgewählt</span>' : ""}
          </div>
          <div class="exercise-meta">
            ${chip(exercise.equipmentType)}
            ${chip(exercise.muscleGroup)}
            ${chip(exercise.weight)}
            ${chip(exercise.targetReps ? `${exercise.targetReps} Ziel-Reps` : "")}
            ${chip(setTypeLabel(exercise.setType))}
            ${chip(exercise.sensorPosition)}
            ${chip(analysisModeLabel(exercise.analysisMode))}
            ${exercise.calibrationProfile ? chip("Kalibriert") : ""}
          </div>
          <p class="muted">${escapeHtml(exercise.notes || "Keine Notizen")}</p>
          <small class="muted">
            ${exercise.referenceRecording ? "Referenz vorhanden" : "Keine Referenz"} ·
            ${exercise.setRecordings.length} Sätze
          </small>
        </div>
        <div class="card-actions">
          ${selected ? "" : `<button type="button" data-action="select-exercise" data-id="${exercise.id}">Auswählen</button>`}
          <button type="button" data-action="record-exercise" data-id="${exercise.id}">Aufnehmen</button>
          <button type="button" data-action="edit-exercise" data-id="${exercise.id}">Bearbeiten</button>
          <button type="button" class="danger" data-action="delete-exercise" data-id="${exercise.id}">Löschen</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderExerciseSelects() {
  const options = appState.exercises.length
    ? appState.exercises.map((exercise) =>
        `<option value="${exercise.id}">${escapeHtml(exercise.name)}</option>`,
      ).join("")
    : '<option value="">Keine Übung vorhanden</option>';

  [elements.recordingExerciseSelect, elements.analysisExerciseSelect].forEach((select) => {
    select.innerHTML = options;
    select.value = appState.selectedExerciseId || "";
    select.disabled = appState.exercises.length === 0 || recording;
  });
  elements.liveExerciseName.textContent = getSelectedExercise()?.name || "Keine Übung ausgewählt";
}

function renderRecordingState() {
  const exercise = getSelectedExercise();
  const sourceReady = hasDataSource();
  elements.startReferenceButton.disabled = recording || !sourceReady || !exercise || Boolean(pendingRecording);
  elements.startSetButton.disabled = recording || !sourceReady || !exercise || Boolean(pendingRecording);
  elements.stopButton.disabled = !recording;
  elements.discardButton.disabled = recording || !pendingRecording;
  elements.saveRecordingButton.disabled = recording || !pendingRecording;
  elements.connectButton.disabled = recording;
  elements.demoButton.disabled = recording;
  elements.calibrateButton.disabled = recording || !sourceReady || !exercise || calibrationActive;
  elements.audioFeedbackToggle.disabled = !("speechSynthesis" in window);
  elements.demoProfile.disabled = recording;
  elements.recordingExerciseSelect.disabled = recording || appState.exercises.length === 0;
  elements.recordingModeValue.textContent =
    recordingMode === "reference" ? "Referenz" :
      recordingMode === "set" ? "Trainingssatz" : "—";
  elements.analysisModeValue.textContent = exercise ? analysisModeLabel(exercise.analysisMode) : "—";
  const isWeightStack = normalizeAnalysisMode(exercise?.analysisMode, exercise?.equipmentType) === "weight_stack";
  if (elements.liveSecondaryChartCard) elements.liveSecondaryChartCard.hidden = isWeightStack;
  elements.sampleCount.textContent = liveAnalysis.dominantAxis || "—";
  elements.liveRepCount.textContent = String(liveAnalysis.reps || 0);
  updateLiveTrainingValues(liveAnalysis);

  if (recording) {
    elements.recordingBadge.textContent = recordingMode === "reference"
      ? "Referenz läuft"
      : "Satz läuft";
    elements.recordingBadge.className = "status status-recording";
  } else if (pendingRecording) {
    elements.recordingBadge.textContent = "Aufnahme prüfen";
    elements.recordingBadge.className = "status status-demo";
  } else {
    elements.recordingBadge.textContent = sourceReady ? "Bereit" : "Datenquelle fehlt";
    elements.recordingBadge.className = `status ${sourceReady ? "status-online" : "status-offline"}`;
  }
}

function renderRecordingPreview() {
  if (!pendingRecording) {
    elements.recordingPreview.hidden = true;
    elements.subjectiveSetPanel.hidden = true;
    return;
  }
  const metrics = pendingRecording.metrics;
  const score = pendingRecording.comparison?.overallScore ?? metrics.movementQualityScore;
  const feedback = pendingRecording.comparison?.feedbackMessages || [
    pendingRecording.type === "reference"
      ? "Diese Aufnahme wird als Referenz der ausgewählten Übung gespeichert."
      : "Noch keine Referenz vorhanden.",
  ];
  elements.recordingPreview.hidden = false;
  elements.subjectiveSetPanel.hidden = pendingRecording.type !== "set";
  elements.recordingPreview.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Aufnahme abgeschlossen</p>
        <h2>${escapeHtml(getSelectedExercise()?.name || pendingRecording.name)}${getSelectedExercise()?.weight ? ` – ${escapeHtml(getSelectedExercise().weight)}` : ""}</h2>
      </div>
      <span class="score ${scoreClass(score)}">${Math.round(score)} %</span>
    </div>
    ${renderAthleteSummary(metrics, pendingRecording.comparison, getSelectedExercise())}
    ${renderRepFeedbackList(metrics.repMetrics)}
    <details class="details-panel metric-details">
      <summary>Technische Metriken anzeigen</summary>
      <div class="result-grid">
        ${metricResult("Dauer", formatDuration(pendingRecording.durationMs))}
        ${metricResult("Ø Rep", formatMilliseconds(metrics.avgRepDurationMs))}
        ${metricResult("Amplitude", formatNumber(metrics.amplitudeEstimate, 3))}
        ${metricResult("ROM", formatRomMetric(metrics, pendingRecording.comparison))}
        ${metricResult("Smoothness", `${metrics.smoothnessScore} %`)}
        ${metricResult("Tremor", formatNumber(metrics.tremorScore, 2))}
        ${metricResult("Fatigue", metrics.fatigue?.fatigueDetected ? `ab Rep ${metrics.fatigue.fatigueStartRep}` : "Nein")}
        ${metricResult("Grenzwertig", metrics.warningRepCount || 0)}
        ${metricResult("Schlecht/unsicher", (metrics.badRepCount || 0) + (metrics.uncertainRepCount || 0))}
        ${metricResult("Hauptgrund", metrics.mainIssue || "—")}
        ${metricResult("Achse", metrics.dominantAxis)}
      </div>
    </details>
    <ul>${feedback.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>
  `;
}

function renderAnalysis() {
  const exercise = getSelectedExercise();
  const recordings = getExerciseRecordings(exercise);
  if (!exercise || recordings.length === 0) {
    elements.analysisEmpty.hidden = false;
    elements.analysisContent.hidden = true;
    return;
  }

  syncAnalysisSelection(exercise);
  elements.analysisEmpty.hidden = true;
  elements.analysisContent.hidden = false;

  elements.recordingCheckboxes.innerHTML = recordings.map((recordingData) => `
    <label class="checkbox-item">
      <input
        type="checkbox"
        data-recording-id="${recordingData.id}"
        ${selectedAnalysisRecordingIds.has(recordingData.id) ? "checked" : ""}
      >
      ${escapeHtml(recordingData.name)}
    </label>
  `).join("");

  const selected = recordings.filter((item) => selectedAnalysisRecordingIds.has(item.id));
  elements.overlayLegend.innerHTML = selected.map((recordingData, index) => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${recordingData.type === "reference" ? CHART_COLORS[0] : CHART_COLORS[(index + 1) % CHART_COLORS.length]}"></span>
      ${escapeHtml(recordingData.name)}
    </span>
  `).join("");

  elements.metricsTableBody.innerHTML = recordings.map((recordingData) => {
    const metrics = recordingData.metrics;
    const score = recordingData.type === "reference"
      ? metrics.movementQualityScore
      : recordingData.comparison?.overallScore ?? metrics.movementQualityScore;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(recordingData.name)}</strong><br>
          <small class="muted">${formatDate(recordingData.createdAt)}</small>
        </td>
        <td><span class="score ${scoreClass(score)}">${Math.round(score)} %</span></td>
        <td>${metrics.reps}</td>
        <td>${formatDuration(recordingData.durationMs)}</td>
        <td>${formatMilliseconds(metrics.avgRepDurationMs)}</td>
        <td>${formatNumber(metrics.amplitudeEstimate, 3)}</td>
        <td>${formatRomMetric(metrics, recordingData.comparison)}</td>
        <td>${metrics.smoothnessScore} %</td>
        <td>${formatNumber(metrics.tremorScore, 2)}</td>
        <td>${metrics.stabilityScore} %</td>
        <td>${metrics.fatigue?.fatigueDetected ? `Rep ${metrics.fatigue.fatigueStartRep}` : "—"}</td>
      </tr>
    `;
  }).join("");

  const setRecordings = exercise.setRecordings;
  elements.feedbackList.innerHTML = setRecordings.length
    ? setRecordings.map((recordingData) => {
        const score = recordingData.comparison?.overallScore ?? recordingData.metrics.movementQualityScore;
        const messages = recordingData.comparison?.feedbackMessages || ["Keine Referenzbewertung vorhanden."];
        return `
          <article class="feedback-card">
            <div class="section-heading">
              <div>
                <h3>${escapeHtml(recordingData.name)}</h3>
                <small class="muted">${formatDate(recordingData.createdAt)}</small>
              </div>
              <div class="card-actions">
                <span class="score ${scoreClass(score)}">${Math.round(score)} %</span>
                <button type="button" class="danger" data-action="delete-set" data-exercise-id="${exercise.id}" data-id="${recordingData.id}">Löschen</button>
              </div>
            </div>
            ${renderAthleteSummary(recordingData.metrics, recordingData.comparison, exercise)}
            <ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>
          </article>
        `;
      }).join("")
    : '<article class="panel empty-state">Noch keine Trainingssätze gespeichert.</article>';
}

function resetAnalysisSelection(exercise) {
  selectedAnalysisRecordingIds.clear();
  if (!exercise) return;
  if (exercise.referenceRecording) selectedAnalysisRecordingIds.add(exercise.referenceRecording.id);
  exercise.setRecordings.slice(-3).forEach((recordingData) => {
    selectedAnalysisRecordingIds.add(recordingData.id);
  });
}

function syncAnalysisSelection(exercise) {
  const validIds = new Set(getExerciseRecordings(exercise).map((item) => item.id));
  selectedAnalysisRecordingIds.forEach((id) => {
    if (!validIds.has(id)) selectedAnalysisRecordingIds.delete(id);
  });
  if (selectedAnalysisRecordingIds.size === 0) {
    resetAnalysisSelection(exercise);
  }
}

function renderExportControls() {
  const exerciseOptions = appState.exercises.length
    ? appState.exercises.map((exercise) =>
        `<option value="${exercise.id}">${escapeHtml(exercise.name)}</option>`,
      ).join("")
    : '<option value="">Keine Übung vorhanden</option>';
  elements.exportExerciseSelect.innerHTML = exerciseOptions;
  if (!getExerciseById(selectedExportExerciseId)) {
    selectedExportExerciseId = appState.selectedExerciseId;
  }
  elements.exportExerciseSelect.value = selectedExportExerciseId || "";

  const exercise = getExerciseById(selectedExportExerciseId);
  const recordings = getExerciseRecordings(exercise);
  elements.exportRecordingSelect.innerHTML = recordings.length
    ? recordings.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${formatDate(item.createdAt)}</option>`).join("")
    : '<option value="">Keine Aufnahme vorhanden</option>';
  elements.downloadCurrentCsvButton.disabled = !(pendingRecording?.rawSamples.length || samples.length);
  elements.downloadSavedCsvButton.disabled = recordings.length === 0;
  elements.exportExerciseButton.disabled = !exercise;
  elements.exportAllButton.disabled = appState.exercises.length === 0;
}

function metricResult(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function renderRepFeedbackList(repMetrics = []) {
  if (!repMetrics.length) {
    return '<p class="muted">Noch keine vollständigen Wiederholungen erkannt.</p>';
  }
  return `
    <div class="rep-feedback-list">
      ${repMetrics.map((rep) => `
        <div class="rep-pill rep-${escapeHtml(rep.qualityClass || "uncertain")}">
          <strong>Rep ${rep.repNumber}</strong>
          <span>${escapeHtml(rep.feedbackText || repQualityLabel(rep.qualityClass))}</span>
          <small>
            ${rep.romPercent !== null ? `ROM ${Math.round(rep.romPercent)} % · ` : ""}
            ${formatMilliseconds(rep.durationMs)} · ${escapeHtml(tremorLevelLabel(rep.tremorLevel))}
          </small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAthleteSummary(metrics = emptyMetrics(), comparison = null, exercise = getSelectedExercise()) {
  const recommendation = metrics.recommendation || generateTrainingRecommendation(metrics, comparison, exercise);
  const fatigueText = metrics.fatigue?.fatigueDetected ? `ab Rep ${metrics.fatigue.fatigueStartRep}` : "nicht deutlich";
  const romText = formatRomMetric(metrics, comparison);
  const cleanText = `${metrics.cleanRepCount || 0}/${metrics.reps || 0}`;
  return `
    <div class="athlete-summary">
      <div>
        <span>Reps erkannt</span>
        <strong>${metrics.reps || 0}</strong>
      </div>
      <div>
        <span>Saubere Reps</span>
        <strong>${cleanText}</strong>
      </div>
      <div>
        <span>Ermüdung</span>
        <strong>${escapeHtml(fatigueText)}</strong>
      </div>
      <div>
        <span>ROM</span>
        <strong>${escapeHtml(romText)}</strong>
      </div>
      <div>
        <span>Tempoverlust</span>
        <strong>${Math.round(metrics.velocityLossPercent || 0)} %</strong>
      </div>
      <div>
        <span>Ruckeln</span>
        <strong>${escapeHtml(tremorLabel(metrics.tremorScore))}</strong>
      </div>
    </div>
    <article class="recommendation-card">
      <span>Empfehlung</span>
      <strong>${escapeHtml(recommendation.label)}</strong>
      <p>${escapeHtml(recommendation.message)}</p>
    </article>
  `;
}

function tremorLevelLabel(level) {
  return {
    low: "Ruckeln niedrig",
    medium: "Ruckeln erhöht",
    high: "Ruckeln hoch",
  }[level] || "Ruckeln —";
}

function formatRomMetric(metrics, comparison = null) {
  const relative = comparison?.relativeRangeOfMotion ?? metrics?.relativeRangeOfMotion;
  if (Number.isFinite(Number(relative))) return `${Math.round(relative)} %`;
  return formatNumber(metrics?.ROMProxy ?? metrics?.amplitudeEstimate, 3);
}

function tremorLabel(score) {
  if (!Number.isFinite(Number(score))) return "—";
  if (score > 2.2) return "hoch";
  if (score > 1.1) return "erhöht";
  return "niedrig";
}

function chip(value) {
  return value ? `<span class="chip">${escapeHtml(value)}</span>` : "";
}

function analysisModeLabel(mode) {
  return {
    weight_stack: "Gewichtsblock",
    barbell: "Langhantel",
    cable_handle: "Kabelzug-Griff",
    free_movement: "Freie Bewegung",
    body_segment: "Körpersegment (Future)",
  }[normalizeAnalysisMode(mode)] || "Freie Bewegung";
}

function setTypeLabel(type) {
  return {
    technique: "Technik",
    hypertrophy: "Hypertrophie",
    strength: "Kraft",
    explosive: "Explosiv",
    warmup: "Warm-up",
  }[normalizeSetType(type)] || "Hypertrophie";
}

function scoreClass(score) {
  if (!Number.isFinite(Number(score))) return "score-neutral";
  if (score >= 75) return "score-good";
  if (score >= 50) return "score-medium";
  return "score-low";
}

function scoreLabel(score) {
  if (score >= 82) return "Sehr ähnlich";
  if (score >= 65) return "Solide";
  if (score >= 45) return "Abweichend";
  return "Deutlich anders";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateCurrentValues(sample) {
  elements.sampleTimestamp.textContent = `t = ${formatNumber(sample.timestamp, 0)} ms`;
  ["ax", "ay", "az", "gx", "gy", "gz"].forEach((key) => {
    elements.values[key].textContent = formatNumber(sample[key], 3);
  });
  if (!recording) {
    elements.values.accMagnitude.textContent = "—";
    elements.values.gyroMagnitude.textContent = "—";
  }
}

function updateLiveTrainingValues(metrics = liveAnalysis) {
  elements.sampleCount.textContent = metrics.dominantAxis || "—";
  const lastRep = metrics.repMetrics?.at(-1);
  elements.values.accMagnitude.textContent = lastRep ? repQualityLabel(lastRep.qualityClass) : "—";
  elements.values.gyroMagnitude.textContent = metrics.reps ? tremorLabel(metrics.tremorScore) : "—";
}

function repQualityLabel(qualityClass) {
  return {
    clean: "Sauber",
    warning: "Grenzwertig",
    bad: "Schlecht",
    uncertain: "Unsicher",
  }[qualityClass] || "—";
}

function resetLiveDisplay() {
  elements.recordingTime.textContent = "00:00.0";
  elements.sampleCount.textContent = "—";
  if (elements.debugSampleCount) elements.debugSampleCount.textContent = "0";
  elements.liveRepCount.textContent = "0";
  elements.sampleTimestamp.textContent = "t = — ms";
  Object.values(elements.values).forEach((element) => {
    element.textContent = "—";
  });
  elements.recordingPreview.hidden = true;
}

function updateRecordingTime() {
  const duration = recording ? Date.now() - recordingStartedAt : recordedDurationMs;
  elements.recordingTime.textContent = formatDuration(duration);
}

function formatDuration(milliseconds) {
  const totalTenths = Math.floor(Math.max(0, milliseconds || 0) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function formatMilliseconds(milliseconds) {
  if (!milliseconds) return "—";
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function formatDate(value) {
  if (!isValidDate(value)) return "Unbekannt";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function setConnectionStatus(text, mode) {
  elements.connectionStatus.textContent = text;
  elements.connectionStatus.className = `status status-${mode}`;
}

function setDemoStatus(text, mode) {
  elements.demoStatus.textContent = text;
  elements.demoStatus.className = `status status-${mode}`;
}

function showMessage(text, type = "error", persistent = false) {
  window.clearTimeout(messageTimeoutId);
  elements.message.textContent = text;
  elements.message.className = `message ${type}`;
  elements.message.hidden = false;
  if (!persistent) {
    messageTimeoutId = window.setTimeout(() => {
      elements.message.hidden = true;
    }, 5000);
  }
}

function clearMessage() {
  window.clearTimeout(messageTimeoutId);
  elements.message.hidden = true;
}

function friendlyError(error) {
  if (error?.name === "NotFoundError") return "Kein Gerät ausgewählt.";
  if (error?.name === "SecurityError") return "Web Bluetooth benötigt localhost oder HTTPS und eine Benutzeraktion.";
  if (error?.name === "NetworkError") return "Gerät oder GATT-Dienst ist nicht erreichbar.";
  if (error?.name === "QuotaExceededError") return "LocalStorage-Speicherlimit erreicht.";
  return error?.message || String(error);
}

// ---------------------------------------------------------------------------
// Canvas-Charts
// ---------------------------------------------------------------------------

function drawCharts() {
  const exercise = getSelectedExercise();
  const metrics = recording || samples.length ? analyzeRecordingByMode(samples, exercise) : emptyMetrics();
  elements.livePrimaryChartTitle.textContent = metrics.signals.primaryLabel;
  elements.liveSecondaryChartTitle.textContent = metrics.signals.secondaryLabel;
  drawSignalChart(elements.accChart, metrics.signals.timestamps, metrics.signals.primary, "#52e0a0", metrics.repTimestamps, "Noch keine Aufnahmedaten", metrics.repSegments);
  drawSignalChart(elements.gyroChart, metrics.signals.timestamps, metrics.signals.secondary, "#62a4ff", metrics.repTimestamps, "Noch keine Aufnahmedaten", metrics.repSegments);
}

function drawSignalChart(canvas, timestamps, values, color, repTimestamps = [], emptyText = "Keine Daten", repSegments = []) {
  const chart = prepareCanvas(canvas);
  if (!chart) return;
  const { context, width, height } = chart;
  const padding = { top: 14, right: 12, bottom: 24, left: 43 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  drawGrid(context, width, height, padding);

  const visibleValues = values.slice(-MAX_LIVE_CHART_SAMPLES);
  const visibleTimestamps = timestamps.slice(-MAX_LIVE_CHART_SAMPLES);
  if (!visibleValues.length) {
    drawEmptyChart(context, padding, chartHeight, emptyText);
    return;
  }

  const range = getChartRange(visibleValues);
  drawAxisLabels(context, range, padding, chartHeight);
  const firstTimestamp = visibleTimestamps[0] || 0;
  const lastTimestamp = visibleTimestamps.at(-1) || firstTimestamp + 1;
  repSegments
    .filter((segment) => segment.endTimestamp >= firstTimestamp && segment.startTimestamp <= lastTimestamp)
    .forEach((segment) => {
      const startX = padding.left + clamp((segment.startTimestamp - firstTimestamp) / Math.max(lastTimestamp - firstTimestamp, 1), 0, 1) * chartWidth;
      const endX = padding.left + clamp((segment.endTimestamp - firstTimestamp) / Math.max(lastTimestamp - firstTimestamp, 1), 0, 1) * chartWidth;
      context.save();
      context.fillStyle = "rgba(82, 224, 160, 0.08)";
      context.fillRect(startX, padding.top, Math.max(2, endX - startX), chartHeight);
      context.restore();
    });
  repTimestamps
    .filter((timestamp) => timestamp >= firstTimestamp && timestamp <= lastTimestamp)
    .forEach((timestamp) => {
      const x = padding.left + ((timestamp - firstTimestamp) / Math.max(lastTimestamp - firstTimestamp, 1)) * chartWidth;
      context.save();
      context.setLineDash([4, 4]);
      context.strokeStyle = "rgba(255, 200, 87, 0.55)";
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, padding.top + chartHeight);
      context.stroke();
      context.restore();
    });
  drawLine(context, visibleValues, range, padding, chartWidth, chartHeight, color, 2.2);
}

function drawSingleChart(canvas, data, property, color, repTimestamps = []) {
  const chart = prepareCanvas(canvas);
  if (!chart) return;
  const { context, width, height } = chart;
  const padding = { top: 14, right: 12, bottom: 24, left: 43 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  drawGrid(context, width, height, padding);

  const visibleData = data.slice(-MAX_LIVE_CHART_SAMPLES);
  if (!visibleData.length) {
    drawEmptyChart(context, padding, chartHeight, "Noch keine Aufnahmedaten");
    return;
  }

  const values = visibleData.map((sample) => sample[property]);
  const range = getChartRange(values);
  drawAxisLabels(context, range, padding, chartHeight);

  const firstTimestamp = visibleData[0].timestamp;
  const lastTimestamp = visibleData.at(-1).timestamp;
  repTimestamps
    .filter((timestamp) => timestamp >= firstTimestamp && timestamp <= lastTimestamp)
    .forEach((timestamp) => {
      const fraction = (timestamp - firstTimestamp) / Math.max(lastTimestamp - firstTimestamp, 1);
      const x = padding.left + fraction * chartWidth;
      context.save();
      context.setLineDash([4, 4]);
      context.strokeStyle = "rgba(255, 200, 87, 0.55)";
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, padding.top + chartHeight);
      context.stroke();
      context.restore();
    });

  drawLine(context, values, range, padding, chartWidth, chartHeight, color, 2.2);
}

function drawAnalysisCharts() {
  const exercise = getSelectedExercise();
  const isWeightStack = normalizeAnalysisMode(exercise?.analysisMode, exercise?.equipmentType) === "weight_stack";
  if (elements.overlaySecondaryChartCard) elements.overlaySecondaryChartCard.hidden = isWeightStack;
  const recordings = getExerciseRecordings(exercise)
    .filter((recordingData) => selectedAnalysisRecordingIds.has(recordingData.id));
  const chartMetrics = recordings.map((recordingData) => ({
    recording: recordingData,
    metrics: recordingData.metrics?.signals?.primary?.length
      ? recordingData.metrics
      : analyzeRecordingByMode(recordingData.rawSamples, exercise),
  }));
  const firstMetrics = chartMetrics[0]?.metrics || emptyMetrics();
  elements.overlayPrimaryTitle.textContent = firstMetrics.signals.primaryLabel || "Referenz vs Satz";
  elements.overlaySecondaryTitle.textContent = firstMetrics.signals.secondaryLabel || "Stabilität / Rotation";
  updateMetricChartTitles(exercise);
  drawSignalOverlayChart(elements.accOverlayChart, chartMetrics, "primary");
  drawSignalOverlayChart(elements.gyroOverlayChart, chartMetrics, "secondary");
  const focus = chartMetrics.find((item) => item.recording.type === "set") || chartMetrics.at(-1);
  drawRepMetricChart(elements.metricChartOne, focus?.metrics.repMetrics || [], "amplitudeProxy", "#52e0a0", "Keine Rep-Metriken");
  drawRepMetricChart(elements.metricChartTwo, focus?.metrics.repMetrics || [], "durationMs", "#ffc857", "Keine Rep-Metriken", 1000);
  drawRepMetricChart(elements.metricChartThree, focus?.metrics.repMetrics || [], "tremorScore", "#ff7f91", "Keine Rep-Metriken");
  drawRepMetricChart(elements.metricChartFour, focus?.metrics.repMetrics || [], getSelectedStabilityMetric(exercise), "#62a4ff", "Keine Rep-Metriken");
}

function updateMetricChartTitles(exercise) {
  const mode = normalizeAnalysisMode(exercise?.analysisMode);
  elements.metricChartOneTitle.textContent = mode === "barbell" ? "ROMProxy pro Rep" : "AmplitudeProxy pro Rep";
  elements.metricChartTwoTitle.textContent = "Rep-Dauer pro Rep";
  elements.metricChartThreeTitle.textContent = mode === "weight_stack" ? "Tremor/Jerk pro Rep" : "Wobble/Tremor pro Rep";
  elements.metricChartFourTitle.textContent = mode === "barbell"
    ? "Tilt-/Rotation-Score"
    : mode === "weight_stack" ? "Sensorcheck / Gyro Debug" : "Gyro-Stabilität pro Rep";
}

function getSelectedStabilityMetric(exercise) {
  return normalizeAnalysisMode(exercise?.analysisMode) === "barbell" ? "barTiltScore" : "gyroStabilityScore";
}

function drawSignalOverlayChart(canvas, chartMetrics, signalKey) {
  const chart = prepareCanvas(canvas);
  if (!chart) return;
  const { context, width, height } = chart;
  const padding = { top: 14, right: 12, bottom: 24, left: 43 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  drawGrid(context, width, height, padding);
  if (!chartMetrics.length) {
    drawEmptyChart(context, padding, chartHeight, "Keine Kurve ausgewählt");
    return;
  }
  const series = chartMetrics.map((item, index) => ({
    recording: item.recording,
    values: resampleValues(item.metrics.signals[signalKey] || [], OVERLAY_POINT_COUNT),
    repTimestamps: item.metrics.repTimestamps || [],
    color: item.recording.type === "reference" ? CHART_COLORS[0] : CHART_COLORS[(index + 1) % CHART_COLORS.length],
  })).filter((item) => item.values.length);
  if (!series.length) {
    drawEmptyChart(context, padding, chartHeight, "Keine Kurve ausgewählt");
    return;
  }
  const range = getChartRange(series.flatMap((item) => item.values));
  drawAxisLabels(context, range, padding, chartHeight);
  series.forEach((item) => {
    if (elements.showRepMarkers.checked && item.repTimestamps.length) {
      const raw = item.recording.rawSamples;
      const start = raw[0]?.timestamp || 0;
      const duration = Math.max(getSampleDuration(raw), 1);
      item.repTimestamps.forEach((timestamp) => {
        const x = padding.left + clamp((timestamp - start) / duration, 0, 1) * chartWidth;
        context.save();
        context.globalAlpha = 0.22;
        context.setLineDash([3, 5]);
        context.strokeStyle = item.color;
        context.beginPath();
        context.moveTo(x, padding.top);
        context.lineTo(x, padding.top + chartHeight);
        context.stroke();
        context.restore();
      });
    }
    drawLine(context, item.values, range, padding, chartWidth, chartHeight, item.color, item.recording.type === "reference" ? 3.3 : 1.9);
  });
}

function drawRepMetricChart(canvas, repMetrics, property, color, emptyText, divisor = 1) {
  const chart = prepareCanvas(canvas);
  if (!chart) return;
  const { context, width, height } = chart;
  const padding = { top: 14, right: 12, bottom: 24, left: 43 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  drawGrid(context, width, height, padding);
  const values = repMetrics.map((rep) => (Number(rep[property]) || 0) / divisor);
  if (!values.length) {
    drawEmptyChart(context, padding, chartHeight, emptyText);
    return;
  }
  const range = getChartRange(values);
  drawAxisLabels(context, range, padding, chartHeight);
  const barWidth = Math.max(6, chartWidth / Math.max(values.length, 1) * 0.58);
  values.forEach((value, index) => {
    const x = padding.left + ((index + 0.5) / values.length) * chartWidth - barWidth / 2;
    const normalized = (value - range.minimum) / Math.max(range.maximum - range.minimum, 0.0001);
    const y = padding.top + chartHeight - normalized * chartHeight;
    context.fillStyle = color;
    context.globalAlpha = 0.84;
    context.fillRect(x, y, barWidth, padding.top + chartHeight - y);
    context.globalAlpha = 1;
  });
}

function drawOverlayChart(canvas, recordings, property) {
  const chart = prepareCanvas(canvas);
  if (!chart) return;
  const { context, width, height } = chart;
  const padding = { top: 14, right: 12, bottom: 24, left: 43 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  drawGrid(context, width, height, padding);

  if (!recordings.length) {
    drawEmptyChart(context, padding, chartHeight, "Keine Kurve ausgewählt");
    return;
  }

  const series = recordings.map((recordingData, index) => ({
    recording: recordingData,
    values: resampleProperty(recordingData.rawSamples, property, OVERLAY_POINT_COUNT),
    color: recordingData.type === "reference"
      ? CHART_COLORS[0]
      : CHART_COLORS[(index + 1) % CHART_COLORS.length],
  }));
  const allValues = series.flatMap((item) => item.values);
  const range = getChartRange(allValues);
  drawAxisLabels(context, range, padding, chartHeight);

  series.forEach((item) => {
    if (elements.showRepMarkers.checked && item.recording.metrics.repTimestamps?.length) {
      const raw = item.recording.rawSamples;
      const start = raw[0]?.timestamp || 0;
      const duration = Math.max(getSampleDuration(raw), 1);
      item.recording.metrics.repTimestamps.forEach((timestamp) => {
        const x = padding.left + clamp((timestamp - start) / duration, 0, 1) * chartWidth;
        context.save();
        context.globalAlpha = 0.22;
        context.setLineDash([3, 5]);
        context.strokeStyle = item.color;
        context.beginPath();
        context.moveTo(x, padding.top);
        context.lineTo(x, padding.top + chartHeight);
        context.stroke();
        context.restore();
      });
    }
    drawLine(
      context,
      item.values,
      range,
      padding,
      chartWidth,
      chartHeight,
      item.color,
      item.recording.type === "reference" ? 3.3 : 1.9,
    );
  });
}

function prepareCanvas(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(rect.width * ratio);
  const pixelHeight = Math.round(rect.height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  return { context, width: rect.width, height: rect.height };
}

function drawGrid(context, width, height, padding) {
  const chartHeight = height - padding.top - padding.bottom;
  context.strokeStyle = "#263853";
  context.lineWidth = 1;
  for (let line = 0; line <= 4; line += 1) {
    const y = padding.top + (chartHeight * line) / 4;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
  }
}

function drawEmptyChart(context, padding, chartHeight, text) {
  context.fillStyle = "#71839e";
  context.font = "12px system-ui";
  context.fillText(text, padding.left + 8, padding.top + chartHeight / 2);
}

function getChartRange(values) {
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  const margin = Math.max((maximum - minimum) * 0.12, Math.abs(maximum) * 0.04, 0.01);
  minimum -= margin;
  maximum += margin;
  return { minimum, maximum };
}

function drawAxisLabels(context, range, padding, chartHeight) {
  context.fillStyle = "#71839e";
  context.font = "10px system-ui";
  context.fillText(range.maximum.toFixed(2), 4, padding.top + 4);
  context.fillText(range.minimum.toFixed(2), 4, padding.top + chartHeight);
}

function drawLine(context, values, range, padding, chartWidth, chartHeight, color, lineWidth) {
  context.save();
  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.lineJoin = "round";
  context.lineCap = "round";
  values.forEach((value, index) => {
    const x = padding.left + (index / Math.max(values.length - 1, 1)) * chartWidth;
    const normalized = (value - range.minimum) / Math.max(range.maximum - range.minimum, 0.0001);
    const y = padding.top + chartHeight - normalized * chartHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
}

// ---------------------------------------------------------------------------
// Events und Initialisierung
// ---------------------------------------------------------------------------

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});
document.querySelectorAll("[data-go-tab]").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.goTab));
});

elements.newExerciseButton.addEventListener("click", () => openExerciseForm());
elements.cancelExerciseButton.addEventListener("click", closeExerciseForm);
elements.exerciseForm.addEventListener("submit", handleExerciseSubmit);
elements.exerciseList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const exercise = getExerciseById(button.dataset.id);
  if (button.dataset.action === "select-exercise") selectExercise(button.dataset.id);
  if (button.dataset.action === "record-exercise") {
    selectExercise(button.dataset.id);
    switchTab("recording");
  }
  if (button.dataset.action === "edit-exercise") openExerciseForm(exercise);
  if (button.dataset.action === "delete-exercise") deleteExercise(button.dataset.id);
});

elements.recordingExerciseSelect.addEventListener("change", () => {
  selectExercise(elements.recordingExerciseSelect.value);
});
elements.analysisExerciseSelect.addEventListener("change", () => {
  selectExercise(elements.analysisExerciseSelect.value);
});
elements.exportExerciseSelect.addEventListener("change", () => {
  selectedExportExerciseId = elements.exportExerciseSelect.value;
  renderExportControls();
});

elements.connectButton.addEventListener("click", connectBle);
elements.demoButton.addEventListener("click", startDemo);
elements.calibrateButton.addEventListener("click", startCalibration);
elements.audioFeedbackToggle.addEventListener("change", () => {
  audioFeedbackEnabled = elements.audioFeedbackToggle.checked;
  audioQueue = [];
  audioProcessing = false;
  if (audioFeedbackEnabled && !("speechSynthesis" in window)) {
    audioFeedbackEnabled = false;
    elements.audioFeedbackToggle.checked = false;
    showMessage("Audiofeedback wird von diesem Browser nicht unterstützt.", "info", true);
  } else if (audioFeedbackEnabled) {
    speakFeedback("Audiofeedback aktiv.");
  }
});
elements.demoProfile.addEventListener("change", () => {
  if (isDemoActive()) {
    setDemoStatus(`${demoProfileLabel(elements.demoProfile.value)} aktiv`, "demo");
  }
});
elements.startReferenceButton.addEventListener("click", () => startRecording("reference"));
elements.startSetButton.addEventListener("click", () => startRecording("set"));
elements.stopButton.addEventListener("click", () => stopRecording(true));
elements.discardButton.addEventListener("click", discardRecording);
elements.saveRecordingButton.addEventListener("click", saveRecording);

elements.recordingCheckboxes.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[data-recording-id]");
  if (!checkbox) return;
  if (checkbox.checked) selectedAnalysisRecordingIds.add(checkbox.dataset.recordingId);
  else selectedAnalysisRecordingIds.delete(checkbox.dataset.recordingId);
  renderAnalysis();
  requestAnimationFrame(drawAnalysisCharts);
});
elements.showRepMarkers.addEventListener("change", drawAnalysisCharts);
elements.feedbackList.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="delete-set"]');
  if (button) deleteSetRecording(button.dataset.exerciseId, button.dataset.id);
});

elements.exportAllButton.addEventListener("click", exportAllData);
elements.importButton.addEventListener("click", () => elements.importFileInput.click());
elements.importFileInput.addEventListener("change", () => importAllData(elements.importFileInput.files[0]));
elements.downloadCurrentCsvButton.addEventListener("click", downloadCurrentRecordingCsv);
elements.downloadSavedCsvButton.addEventListener("click", downloadSavedRecordingCsv);
elements.exportExerciseButton.addEventListener("click", exportSelectedExercise);
elements.deleteAllButton.addEventListener("click", deleteAllData);

window.addEventListener("resize", () => {
  drawCharts();
  drawAnalysisCharts();
});

if ("ResizeObserver" in window) {
  const observer = new ResizeObserver(() => {
    if (activeTab === "recording") drawCharts();
    if (activeTab === "analysis") drawAnalysisCharts();
  });
  [
    elements.accChart,
    elements.gyroChart,
    elements.accOverlayChart,
    elements.gyroOverlayChart,
    elements.metricChartOne,
    elements.metricChartTwo,
    elements.metricChartThree,
    elements.metricChartFour,
  ]
    .forEach((canvas) => observer.observe(canvas));
}

if (!navigator.bluetooth) {
  showMessage(
    "Web Bluetooth wird in diesem Browser nicht unterstützt. Der Demo-Modus bleibt vollständig nutzbar.",
    "info",
    true,
  );
}

resetAnalysisSelection(getSelectedExercise());
renderAll();
