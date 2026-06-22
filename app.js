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
  sensorPosition: document.querySelector("#sensorPosition"),
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
  startReferenceButton: document.querySelector("#startReferenceButton"),
  startSetButton: document.querySelector("#startSetButton"),
  stopButton: document.querySelector("#stopButton"),
  discardButton: document.querySelector("#discardButton"),
  saveRecordingButton: document.querySelector("#saveRecordingButton"),
  recordingModeValue: document.querySelector("#recordingModeValue"),
  recordingTime: document.querySelector("#recordingTime"),
  sampleCount: document.querySelector("#sampleCount"),
  liveRepCount: document.querySelector("#liveRepCount"),
  liveExerciseName: document.querySelector("#liveExerciseName"),
  sampleTimestamp: document.querySelector("#sampleTimestamp"),
  recordingPreview: document.querySelector("#recordingPreview"),
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
let demoLastTickAt = 0;
let demoPhase = 0;
let messageTimeoutId = null;

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
    exercises: [
      {
        id: starterId,
        name: "Brustpresse",
        equipmentType: "Geführte Maschine",
        muscleGroup: "Brust",
        weight: "",
        sensorPosition: "Gewichtsblock",
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

  const exercises = input.exercises.map((exercise) => ({
    id: String(exercise.id || createId()),
    name: String(exercise.name || "Unbenannte Übung"),
    equipmentType: String(exercise.equipmentType || ""),
    muscleGroup: String(exercise.muscleGroup || ""),
    weight: String(exercise.weight || ""),
    sensorPosition: String(exercise.sensorPosition || ""),
    notes: String(exercise.notes || ""),
    referenceRecording: normalizeRecording(exercise.referenceRecording),
    setRecordings: Array.isArray(exercise.setRecordings)
      ? exercise.setRecordings.map(normalizeRecording).filter(Boolean)
      : [],
  }));

  const selectedExists = exercises.some((exercise) => exercise.id === input.selectedExerciseId);
  return {
    version: 1,
    selectedExerciseId: selectedExists ? input.selectedExerciseId : exercises[0]?.id || null,
    exercises,
  };
}

function normalizeRecording(recordingData) {
  if (!recordingData || !Array.isArray(recordingData.rawSamples)) {
    return null;
  }

  const rawSamples = recordingData.rawSamples.map(normalizeSample).filter(Boolean);
  const metrics = analyzeRecording(rawSamples);
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
    metrics: { ...metrics, ...(recordingData.metrics || {}) },
    comparison: recordingData.comparison || null,
  };
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
  const deltaSeconds = Math.max(0.001, (now - demoLastTickAt) / 1000);
  demoLastTickAt = now;
  const profile = elements.demoProfile.value;

  let period = 1.8;
  let amplitude = 0.68;
  let noiseLevel = 0.018;
  if (profile === "fast") period = 0.95;
  if (profile === "short") amplitude = 0.34;
  if (profile === "jerky") noiseLevel = 0.065;
  if (profile === "fatigue") {
    const fatigue = clamp(elapsedSeconds / 35, 0, 1);
    period = 1.8 + fatigue * 0.55;
    amplitude = 0.68 * (1 - fatigue * 0.48);
    noiseLevel = 0.018 + fatigue * 0.055;
  }

  demoPhase = (demoPhase + deltaSeconds / period) % 1;
  const phase = demoPhase;
  const smoothPulse = Math.sin(Math.PI * phase) ** 2;
  const velocity = Math.sin(2 * Math.PI * phase);
  const direction = Math.cos(2 * Math.PI * phase);
  const gaussian = (center, width) => Math.exp(-((phase - center) ** 2) / width);
  const jerk = profile === "jerky"
    ? 0.38 * gaussian(0.22, 0.0009) - 0.28 * gaussian(0.68, 0.0014)
    : 0;
  const randomNoise = () => (Math.random() - 0.5) * 2 * noiseLevel;

  const ax = 0.08 * direction + jerk * 0.32 + randomNoise();
  const ay = 0.05 * velocity + jerk * 0.18 + randomNoise();
  const az = 1 + amplitude * smoothPulse + jerk + randomNoise();
  const gyroScale = profile === "short" ? 18 : profile === "fast" ? 43 : 30;
  const gx = gyroScale * velocity + jerk * 95 + randomNoise() * 20;
  const gy = gyroScale * 0.35 * direction + randomNoise() * 18;
  const gz = gyroScale * 0.18 * velocity + jerk * 55 + randomNoise() * 18;
  const line = [Math.round(elapsedMs), ax, ay, az, gx, gy, gz].join(",");

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
  if (!line || line.split(",").length !== 7) return false;
  return line.split(",").every((part) => part.trim() !== "" && Number.isFinite(Number(part)));
}

function parseDataLine(line) {
  if (!isValidDataLine(line)) return null;
  const [timestamp, ax, ay, az, gx, gy, gz] = line.split(",").map(Number);
  if (timestamp < 0) return null;
  return {
    timestamp,
    ax,
    ay,
    az,
    gx,
    gy,
    gz,
    accMagnitude: Math.hypot(ax, ay, az),
    gyroMagnitude: Math.hypot(gx, gy, gz),
  };
}

function processDataLine(line, source) {
  const sample = parseDataLine(line);
  if (!sample) return;

  updateCurrentValues(sample);
  if (!recording) return;

  samples.push(sample);
  elements.sampleCount.textContent = String(samples.length);

  if (samples.length % 8 === 0 || samples.length < 10) {
    liveAnalysis = analyzeRecording(samples);
    elements.liveRepCount.textContent = String(liveAnalysis.reps);
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
    recordedDurationMs = 0;
    liveAnalysis = emptyMetrics();
    recordingTimerId = window.setInterval(updateRecordingTime, 100);
    elements.recordingPreview.hidden = true;
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
  window.clearInterval(recordingTimerId);
  recordingTimerId = null;

  if (sendCommand && isBluetoothConnected()) {
    try {
      await writeControlCommand("STOP\n");
    } catch (error) {
      showMessage(`Aufnahme beendet, STOP konnte aber nicht gesendet werden: ${friendlyError(error)}`);
    }
  }

  liveAnalysis = analyzeRecording(samples);
  const exercise = getSelectedExercise();
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
  };

  if (type === "set" && exercise?.referenceRecording) {
    pendingRecording.comparison = compareRecordingToReference(
      pendingRecording,
      exercise.referenceRecording,
    );
    pendingRecording.metrics.movementQualityScore = pendingRecording.comparison.overallScore;
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
  recordedDurationMs = 0;
  liveAnalysis = emptyMetrics();
  resetLiveDisplay();
  renderRecordingState();
  drawCharts();
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

  if (exercise.referenceRecording) {
    pendingRecording.comparison = compareRecordingToReference(
      pendingRecording,
      exercise.referenceRecording,
    );
    pendingRecording.metrics.movementQualityScore = pendingRecording.comparison.overallScore;
  } else {
    pendingRecording.metrics.movementQualityScore = Math.round(
      (pendingRecording.metrics.smoothnessScore + pendingRecording.metrics.tempoConsistencyScore) / 2,
    );
    pendingRecording.comparison = {
      overallScore: null,
      feedbackMessages: ["Keine Referenz vorhanden. Der Satz wurde ohne Referenzvergleich gespeichert."],
    };
  }

  exercise.setRecordings.push(pendingRecording);
  saveState();
  showMessage(`${pendingRecording.name} wurde gespeichert.`, "success");
  const savedId = pendingRecording.id;
  pendingRecording = null;
  recordingMode = null;
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
  pendingRecording.metrics.movementQualityScore = Math.round(
    (pendingRecording.metrics.smoothnessScore + pendingRecording.metrics.tempoConsistencyScore) / 2,
  );
  exercise.referenceRecording = pendingRecording;

  // Bestehende Sätze werden mit der neuen Referenz neu bewertet.
  exercise.setRecordings.forEach((setRecording) => {
    setRecording.comparison = compareRecordingToReference(setRecording, pendingRecording);
    setRecording.metrics.movementQualityScore = setRecording.comparison.overallScore;
  });

  selectedAnalysisRecordingIds.add(pendingRecording.id);
  saveState();
  pendingRecording = null;
  recordingMode = null;
  showMessage("Referenz für diese Übung gespeichert.", "success");
  renderAll();
}

function compareWithReference() {
  const exercise = getSelectedExercise();
  const current = pendingRecording || (
    samples.length
      ? {
          rawSamples: samples,
          metrics: analyzeRecording(samples),
          durationMs: getSampleDuration(samples),
        }
      : null
  );
  if (!exercise?.referenceRecording || !current) return null;
  return compareRecordingToReference(current, exercise.referenceRecording);
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
    accMagnitude: sample.accMagnitude,
    gyroMagnitude: sample.gyroMagnitude,
  };
}

// ---------------------------------------------------------------------------
// Analyse, Rep-Erkennung und Referenzvergleich
// ---------------------------------------------------------------------------

function emptyMetrics() {
  return {
    reps: 0,
    durationMs: 0,
    avgRepDurationMs: 0,
    avgAccMagnitude: 0,
    maxAccMagnitude: 0,
    avgGyroMagnitude: 0,
    maxGyroMagnitude: 0,
    amplitudeEstimate: 0,
    smoothnessScore: 0,
    tempoConsistencyScore: 0,
    movementQualityScore: 0,
    repTimestamps: [],
    repSegments: [],
    repAmplitudes: [],
  };
}

function analyzeRecording(inputSamples) {
  if (!Array.isArray(inputSamples) || inputSamples.length === 0) {
    return emptyMetrics();
  }

  const data = inputSamples.filter((sample) =>
    Number.isFinite(sample.timestamp) &&
    Number.isFinite(sample.accMagnitude) &&
    Number.isFinite(sample.gyroMagnitude),
  );
  if (data.length === 0) return emptyMetrics();

  const durationMs = getSampleDuration(data);
  const accValues = data.map((sample) => sample.accMagnitude);
  const gyroValues = data.map((sample) => sample.gyroMagnitude);
  const sampleIntervalMs = estimateSampleInterval(data);
  const shortWindow = Math.max(3, Math.round(180 / sampleIntervalMs));
  const baselineWindow = Math.max(shortWindow + 2, Math.round(1000 / sampleIntervalMs));
  const smoothedAcc = movingAverage(accValues, shortWindow);
  const baseline = movingAverage(accValues, baselineWindow);
  const positiveMotion = smoothedAcc.map((value, index) => Math.max(0, value - baseline[index]));
  const motionEnvelope = movingAverage(positiveMotion, Math.max(2, Math.round(100 / sampleIntervalMs)));
  const motionMean = average(motionEnvelope);
  const motionStd = standardDeviation(motionEnvelope);
  const adaptiveThreshold = Math.max(0.035, motionMean + motionStd * 0.6);
  const minimumRepDistanceMs = 500;
  const peakIndices = [];

  for (let index = 2; index < motionEnvelope.length - 2; index += 1) {
    const isLocalPeak =
      motionEnvelope[index] >= motionEnvelope[index - 1] &&
      motionEnvelope[index] > motionEnvelope[index + 1] &&
      motionEnvelope[index] >= motionEnvelope[index - 2] &&
      motionEnvelope[index] >= motionEnvelope[index + 2];
    if (!isLocalPeak || motionEnvelope[index] < adaptiveThreshold) continue;

    const previousPeakIndex = peakIndices[peakIndices.length - 1];
    if (
      previousPeakIndex === undefined ||
      data[index].timestamp - data[previousPeakIndex].timestamp >= minimumRepDistanceMs
    ) {
      peakIndices.push(index);
    } else if (motionEnvelope[index] > motionEnvelope[previousPeakIndex]) {
      peakIndices[peakIndices.length - 1] = index;
    }
  }

  // Fallback für Bewegungen, deren Magnitude überwiegend unter den lokalen
  // Basiswert fällt. Weiterhin wird accMagnitude als Primärsignal verwendet.
  if (peakIndices.length === 0 && motionStd > 0.02) {
    const absoluteMotion = smoothedAcc.map((value, index) => Math.abs(value - baseline[index]));
    const fallbackEnvelope = movingAverage(absoluteMotion, Math.max(2, Math.round(120 / sampleIntervalMs)));
    const threshold = Math.max(0.045, average(fallbackEnvelope) + standardDeviation(fallbackEnvelope) * 0.8);
    for (let index = 2; index < fallbackEnvelope.length - 2; index += 1) {
      if (
        fallbackEnvelope[index] >= threshold &&
        fallbackEnvelope[index] > fallbackEnvelope[index - 1] &&
        fallbackEnvelope[index] >= fallbackEnvelope[index + 1]
      ) {
        const previous = peakIndices[peakIndices.length - 1];
        if (previous === undefined || data[index].timestamp - data[previous].timestamp >= minimumRepDistanceMs) {
          peakIndices.push(index);
        }
      }
    }
  }

  const repTimestamps = peakIndices.map((index) => data[index].timestamp);
  const repSegments = createRepSegments(peakIndices, data);
  const repIntervals = repTimestamps.slice(1).map((timestamp, index) => timestamp - repTimestamps[index]);
  const avgRepDurationMs = repIntervals.length
    ? average(repIntervals)
    : peakIndices.length === 1
      ? durationMs
      : 0;
  const repAmplitudes = repSegments.map((segment) => {
    const values = accValues.slice(segment.startIndex, segment.endIndex + 1);
    return Math.max(0, percentile(values, 0.95) - percentile(values, 0.1));
  });
  const amplitudeEstimate = repAmplitudes.length
    ? average(repAmplitudes)
    : Math.max(0, percentile(accValues, 0.95) - percentile(accValues, 0.1));

  const residuals = accValues.map((value, index) => value - smoothedAcc[index]);
  const signalSpread = Math.max(standardDeviation(smoothedAcc), 0.02);
  const noiseRatio = standardDeviation(residuals) / signalSpread;
  const velocity = smoothedAcc.slice(1).map(
    (value, index) => (value - smoothedAcc[index]) / Math.max(sampleIntervalMs / 1000, 0.001),
  );
  const velocityVariation = standardDeviation(velocity) / Math.max(amplitudeEstimate, 0.04);
  const smoothnessScore = Math.round(clamp(100 - noiseRatio * 58 - velocityVariation * 1.5, 0, 100));

  let tempoConsistencyScore = 0;
  if (repIntervals.length >= 2) {
    const coefficientOfVariation =
      standardDeviation(repIntervals) / Math.max(average(repIntervals), 1);
    tempoConsistencyScore = Math.round(clamp(100 - coefficientOfVariation * 240, 0, 100));
  } else if (peakIndices.length === 1) {
    tempoConsistencyScore = 55;
  }

  const movementQualityScore = Math.round(
    clamp(smoothnessScore * 0.55 + tempoConsistencyScore * 0.45, 0, 100),
  );

  return {
    reps: peakIndices.length,
    durationMs,
    avgRepDurationMs: Math.round(avgRepDurationMs),
    avgAccMagnitude: average(accValues),
    maxAccMagnitude: Math.max(...accValues),
    avgGyroMagnitude: average(gyroValues),
    maxGyroMagnitude: Math.max(...gyroValues),
    amplitudeEstimate,
    smoothnessScore,
    tempoConsistencyScore,
    movementQualityScore,
    repTimestamps,
    repSegments,
    repAmplitudes,
  };
}

function createRepSegments(peakIndices, data) {
  return peakIndices.map((peakIndex, index) => {
    const previousPeak = peakIndices[index - 1];
    const nextPeak = peakIndices[index + 1];
    const startIndex = previousPeak === undefined ? 0 : Math.floor((previousPeak + peakIndex) / 2);
    const endIndex = nextPeak === undefined
      ? data.length - 1
      : Math.floor((peakIndex + nextPeak) / 2);
    return {
      startIndex,
      peakIndex,
      endIndex,
      startTimestamp: data[startIndex].timestamp,
      peakTimestamp: data[peakIndex].timestamp,
      endTimestamp: data[endIndex].timestamp,
    };
  });
}

function compareRecordingToReference(currentRecording, referenceRecording) {
  const currentMetrics = currentRecording.metrics || analyzeRecording(currentRecording.rawSamples);
  const referenceMetrics = referenceRecording.metrics || analyzeRecording(referenceRecording.rawSamples);
  const tooLittleData =
    currentRecording.rawSamples.length < MIN_ANALYSIS_SAMPLES ||
    referenceRecording.rawSamples.length < MIN_ANALYSIS_SAMPLES;

  const accCurveError = normalizedCurveRmse(
    currentRecording.rawSamples,
    referenceRecording.rawSamples,
    "accMagnitude",
  );
  const gyroCurveError = normalizedCurveRmse(
    currentRecording.rawSamples,
    referenceRecording.rawSamples,
    "gyroMagnitude",
  );
  const accCurveScore = errorToScore(accCurveError);
  const gyroCurveScore = errorToScore(gyroCurveError);
  const repCountDiff = currentMetrics.reps - referenceMetrics.reps;
  const repScore = percentSimilarity(currentMetrics.reps, referenceMetrics.reps);
  const repDurationScore = percentSimilarity(
    currentMetrics.avgRepDurationMs,
    referenceMetrics.avgRepDurationMs,
  );
  const amplitudeScore = percentSimilarity(
    currentMetrics.amplitudeEstimate,
    referenceMetrics.amplitudeEstimate,
  );
  const durationDiffPercent = percentDifference(
    currentMetrics.durationMs,
    referenceMetrics.durationMs,
  );
  const avgRepDurationDiffPercent = percentDifference(
    currentMetrics.avgRepDurationMs,
    referenceMetrics.avgRepDurationMs,
  );
  const amplitudeDiffPercent = percentDifference(
    currentMetrics.amplitudeEstimate,
    referenceMetrics.amplitudeEstimate,
  );
  const smoothnessDiffPercent = percentDifference(
    currentMetrics.smoothnessScore,
    referenceMetrics.smoothnessScore,
  );
  const tempoConsistencyDiffPercent = percentDifference(
    currentMetrics.tempoConsistencyScore,
    referenceMetrics.tempoConsistencyScore,
  );

  let overallScore = Math.round(
    accCurveScore * 0.35 +
    gyroCurveScore * 0.2 +
    repScore * 0.15 +
    repDurationScore * 0.15 +
    amplitudeScore * 0.15,
  );
  if (tooLittleData) overallScore = Math.min(overallScore, 35);

  const feedbackMessages = [];
  if (tooLittleData) {
    feedbackMessages.push("Datenmenge zu gering für eine sinnvolle Analyse.");
  } else if (overallScore >= 82) {
    feedbackMessages.push("Sehr ähnlich zur Referenz.");
  } else if (overallScore >= 65) {
    feedbackMessages.push("Die Ausführung ist insgesamt ähnlich zur Referenz.");
  } else {
    feedbackMessages.push("Die Ausführung weicht deutlich von der Referenz ab.");
  }

  if (repCountDiff < 0) {
    feedbackMessages.push("Du hast weniger Wiederholungen als in der Referenz ausgeführt.");
  } else if (repCountDiff > 0) {
    feedbackMessages.push("Du hast mehr Wiederholungen als in der Referenz ausgeführt.");
  }
  if (avgRepDurationDiffPercent < -15) {
    feedbackMessages.push("Die Bewegung war deutlich schneller als die Referenz.");
  } else if (avgRepDurationDiffPercent > 18) {
    feedbackMessages.push("Die Bewegung war deutlich langsamer als die Referenz.");
  }
  if (amplitudeDiffPercent < -15) {
    feedbackMessages.push("Die Bewegungsamplitude ist geringer als in der Referenz.");
  } else if (amplitudeDiffPercent > 22) {
    feedbackMessages.push("Die Bewegungsamplitude ist größer als in der Referenz.");
  }
  if (smoothnessDiffPercent < -12) {
    feedbackMessages.push("Die Bewegung war ruckartiger als die Referenz.");
  }
  if (tempoConsistencyDiffPercent < -15) {
    feedbackMessages.push("Das Wiederholungstempo war ungleichmäßiger als in der Referenz.");
  }
  if (detectEndFatigue(currentMetrics)) {
    feedbackMessages.push("Die letzten Wiederholungen wirken ungleichmäßiger oder kürzer.");
  }
  if (feedbackMessages.length === 1 && overallScore >= 82) {
    feedbackMessages.push("Tempo, Amplitude und Kurvenverlauf liegen nah an der Vorlage.");
  }

  return {
    overallScore,
    repCountDiff,
    durationDiffPercent,
    avgRepDurationDiffPercent,
    amplitudeDiffPercent,
    smoothnessDiffPercent,
    tempoConsistencyDiffPercent,
    accCurveError,
    gyroCurveError,
    feedbackMessages,
  };
}

function detectEndFatigue(metrics) {
  const amplitudes = metrics.repAmplitudes || [];
  if (amplitudes.length < 4) return false;
  const groupSize = Math.max(2, Math.floor(amplitudes.length / 3));
  const first = average(amplitudes.slice(0, groupSize));
  const last = average(amplitudes.slice(-groupSize));
  return last < first * 0.84;
}

function normalizedCurveRmse(currentSamples, referenceSamples, property) {
  if (!currentSamples?.length || !referenceSamples?.length) return 2;
  const current = resampleProperty(currentSamples, property, OVERLAY_POINT_COUNT);
  const reference = resampleProperty(referenceSamples, property, OVERLAY_POINT_COUNT);
  const referenceRange = percentile(reference, 0.95) - percentile(reference, 0.05);
  const scale = Math.max(referenceRange, standardDeviation(reference), Math.abs(average(reference)) * 0.08, 0.01);
  const squaredError = current.reduce(
    (sum, value, index) => sum + (value - reference[index]) ** 2,
    0,
  );
  return Math.sqrt(squaredError / current.length) / scale;
}

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

function movingAverage(values, windowSize) {
  const result = new Array(values.length);
  let sum = 0;
  const half = Math.floor(windowSize / 2);
  const prefix = [0];
  values.forEach((value) => prefix.push(prefix[prefix.length - 1] + value));
  for (let index = 0; index < values.length; index += 1) {
    const start = Math.max(0, index - half);
    const end = Math.min(values.length - 1, index + half);
    sum = prefix[end + 1] - prefix[start];
    result[index] = sum / (end - start + 1);
  }
  return result;
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

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(fraction, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function resampleProperty(data, property, targetLength) {
  if (!data.length || targetLength <= 0) return [];
  if (data.length === 1) return new Array(targetLength).fill(Number(data[0][property]) || 0);
  const result = [];
  for (let index = 0; index < targetLength; index += 1) {
    const position = (index * (data.length - 1)) / Math.max(targetLength - 1, 1);
    const lower = Math.floor(position);
    const upper = Math.min(data.length - 1, Math.ceil(position));
    const weight = position - lower;
    const lowerValue = Number(data[lower][property]) || 0;
    const upperValue = Number(data[upper][property]) || 0;
    result.push(lowerValue * (1 - weight) + upperValue * weight);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Übungsverwaltung
// ---------------------------------------------------------------------------

function openExerciseForm(exercise = null) {
  editingExerciseId = exercise?.id || null;
  elements.exerciseFormTitle.textContent = exercise ? "Übung bearbeiten" : "Neue Übung";
  elements.exerciseId.value = exercise?.id || "";
  elements.exerciseName.value = exercise?.name || "";
  elements.equipmentType.value = exercise?.equipmentType || "Geführte Maschine";
  elements.muscleGroup.value = exercise?.muscleGroup || "";
  elements.exerciseWeight.value = exercise?.weight || "";
  elements.sensorPosition.value = exercise?.sensorPosition || "";
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
    sensorPosition: elements.sensorPosition.value.trim(),
    notes: elements.exerciseNotes.value.trim(),
  };

  if (editingExerciseId) {
    const exercise = getExerciseById(editingExerciseId);
    if (exercise) Object.assign(exercise, values);
  } else {
    const exercise = {
      id: createId(),
      ...values,
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
  const header = "timestamp_ms,ax,ay,az,gx,gy,gz,accMagnitude,gyroMagnitude";
  const rows = data.map((sample) =>
    [
      sample.timestamp,
      sample.ax,
      sample.ay,
      sample.az,
      sample.gx,
      sample.gy,
      sample.gz,
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
  appState = { version: 1, selectedExerciseId: null, exercises: [] };
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
    ["Übung", exercise?.name || "Keine ausgewählt"],
    ["Referenz", exercise?.referenceRecording ? "Vorhanden" : "Fehlt"],
    ["Gespeicherte Sätze", String(exercise?.setRecordings.length || 0)],
    ["Sensorposition", exercise?.sensorPosition || "—"],
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
            ${chip(exercise.sensorPosition)}
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
  elements.demoProfile.disabled = recording;
  elements.recordingExerciseSelect.disabled = recording || appState.exercises.length === 0;
  elements.recordingModeValue.textContent =
    recordingMode === "reference" ? "Referenz" :
      recordingMode === "set" ? "Trainingssatz" : "—";
  elements.sampleCount.textContent = String(samples.length);
  elements.liveRepCount.textContent = String(liveAnalysis.reps || 0);

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
  elements.recordingPreview.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Aufnahme abgeschlossen</p>
        <h2>${escapeHtml(pendingRecording.name)}</h2>
      </div>
      <span class="score ${scoreClass(score)}">${Math.round(score)} %</span>
    </div>
    <div class="result-grid">
      ${metricResult("Reps", metrics.reps)}
      ${metricResult("Dauer", formatDuration(pendingRecording.durationMs))}
      ${metricResult("Ø Rep", formatMilliseconds(metrics.avgRepDurationMs))}
      ${metricResult("Amplitude", formatNumber(metrics.amplitudeEstimate, 3))}
      ${metricResult("Smoothness", `${metrics.smoothnessScore} %`)}
      ${metricResult("Tempo", `${metrics.tempoConsistencyScore} %`)}
      ${metricResult("Ø Acc", formatNumber(metrics.avgAccMagnitude, 3))}
      ${metricResult("Max Gyro", formatNumber(metrics.maxGyroMagnitude, 1))}
    </div>
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
        <td>${metrics.smoothnessScore} %</td>
        <td>${metrics.tempoConsistencyScore} %</td>
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

function chip(value) {
  return value ? `<span class="chip">${escapeHtml(value)}</span>` : "";
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
  elements.values.accMagnitude.textContent = formatNumber(sample.accMagnitude, 3);
  elements.values.gyroMagnitude.textContent = formatNumber(sample.gyroMagnitude, 3);
}

function resetLiveDisplay() {
  elements.recordingTime.textContent = "00:00.0";
  elements.sampleCount.textContent = "0";
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
  const metrics = recording || samples.length ? analyzeRecording(samples) : emptyMetrics();
  drawSingleChart(elements.accChart, samples, "accMagnitude", "#52e0a0", metrics.repTimestamps);
  drawSingleChart(elements.gyroChart, samples, "gyroMagnitude", "#62a4ff", metrics.repTimestamps);
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
  const recordings = getExerciseRecordings(exercise)
    .filter((recordingData) => selectedAnalysisRecordingIds.has(recordingData.id));
  drawOverlayChart(elements.accOverlayChart, recordings, "accMagnitude");
  drawOverlayChart(elements.gyroOverlayChart, recordings, "gyroMagnitude");
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
  [elements.accChart, elements.gyroChart, elements.accOverlayChart, elements.gyroOverlayChart]
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
