import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/services/supabaseClient';

const MEDIA_BUCKET = 'rakshak';
const CHUNK_DURATION_MS = 30000; // 30 sec per chunk
const MAX_CHUNKS = 2;            // 2 x 30s = 1 minute total, then auto-stop

let isRecording = false;
let currentRecording = null;
let chunkLoopTimer = null;
let chunkCount = 0;

/**
 * Starts chunked audio recording tied to an incident, capped at MAX_CHUNKS
 * (1 minute total). Each chunk is recorded, stopped, uploaded, and
 * registered independently, then the next chunk starts immediately — so if
 * the phone is damaged or loses connection mid-incident, chunks already
 * uploaded remain as evidence.
 *
 * Location is NOT sent per-chunk here — same pattern as photo uploads.
 * Coordinates live on the Incident row (set once at /sos) and are read via
 * the incident_id foreign key join on the backend/dashboard side.
 *
 * @param {string} incidentId - same id used for /sos and photo uploads
 * @param {string} apiBase - your FastAPI base URL
 * @param {(status: string) => void} onStatus - optional callback for UI feedback
 */
export async function startChunkedRecording(incidentId, apiBase, onStatus = () => {}) {
  if (isRecording) return;

  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') {
    onStatus('Microphone permission denied');
    return;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  isRecording = true;
  chunkCount = 0;
  onStatus('Recording started');
  recordNextChunk(incidentId, apiBase, onStatus);
}

async function recordNextChunk(incidentId, apiBase, onStatus) {
  if (!isRecording) return;

  if (chunkCount >= MAX_CHUNKS) {
    onStatus('Recording limit reached (1 min) — stopped');
    await stopChunkedRecording();
    return;
  }

  try {
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    currentRecording = recording;

    chunkLoopTimer = setTimeout(async () => {
      await finishChunkAndContinue(incidentId, apiBase, onStatus);
    }, CHUNK_DURATION_MS);
  } catch (err) {
    console.warn('Failed to start recording chunk:', err);
    onStatus('Recording error — retrying');
    if (isRecording) {
      chunkLoopTimer = setTimeout(
        () => recordNextChunk(incidentId, apiBase, onStatus),
        2000
      );
    }
  }
}

async function finishChunkAndContinue(incidentId, apiBase, onStatus) {
  const recording = currentRecording;
  currentRecording = null;
  if (!recording) return;

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    chunkCount += 1;

    if (isRecording && chunkCount < MAX_CHUNKS) {
      recordNextChunk(incidentId, apiBase, onStatus);
    } else if (isRecording) {
      onStatus('Recording limit reached (1 min) — stopped');
      await stopChunkedRecording();
    }

    await uploadAudioChunk(uri, incidentId, apiBase, onStatus);
  } catch (err) {
    console.warn('Failed to finish/upload chunk:', err);
    onStatus('Chunk upload failed — continuing');
  }
}

async function uploadAudioChunk(uri, incidentId, apiBase, onStatus) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

  const storagePath = `${incidentId}/audio/${Date.now()}.m4a`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, decode(base64), {
      contentType: 'audio/m4a',
      upsert: false,
    });

  if (uploadError) {
    console.warn('Audio chunk upload to Supabase failed:', uploadError);
    onStatus('Chunk upload failed');
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(storagePath);

  const approxFileSizeBytes = base64.length ? Math.floor(base64.length * 0.75) : null;

  try {
    // Same shape as the photo upload's /media call — media_type differs,
    // no latitude/longitude sent, incident_id is the only location link
    // (via FK join to incidents on the backend).
    const registerRes = await fetch(`${apiBase}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'audio',
        file_path: publicUrlData.publicUrl,
        file_size_bytes: approxFileSizeBytes,
        mime_type: 'audio/m4a',
        uploaded_by: 'guest',
        incident_id: incidentId,
      }),
    });
    if (!registerRes.ok) throw new Error(`Server responded ${registerRes.status}`);
    onStatus('Chunk uploaded');
  } catch (err) {
    console.warn('Failed to register audio chunk with backend:', err);
    onStatus('Chunk saved to storage, backend registration failed');
  }
}

/**
 * Stops the chunked recording loop. Called automatically once MAX_CHUNKS is
 * reached, or manually if the victim marks themselves safe early.
 */
export async function stopChunkedRecording() {
  isRecording = false;
  if (chunkLoopTimer) {
    clearTimeout(chunkLoopTimer);
    chunkLoopTimer = null;
  }
  if (currentRecording) {
    try {
      await currentRecording.stopAndUnloadAsync();
    } catch (err) {
      console.warn('Error stopping final chunk:', err);
    }
    currentRecording = null;
  }
}

export function isChunkedRecordingActive() {
  return isRecording;
}