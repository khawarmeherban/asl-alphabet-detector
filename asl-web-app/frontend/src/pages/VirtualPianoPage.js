import React, { useMemo, useRef, useState } from 'react';
import { Music2, Camera, Activity } from 'lucide-react';
import useLiveDetectionEngine from '../features/liveDetection/useLiveDetectionEngine';
import VirtualPiano from '../components/VirtualPiano';

export default function VirtualPianoPage() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);

  const [isTracking, setIsTracking] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [pianoEnabled, setPianoEnabled] = useState(true);
  const [pianoMode, setPianoMode] = useState('piano');
  const [lastPlayedNote, setLastPlayedNote] = useState('');
  const [noteHistory, setNoteHistory] = useState([]);

  const { cameraStatus, connectionStatus, lastLandmarks, predictionState, error } = useLiveDetectionEngine({
    enabled: isTracking,
    videoRef,
    overlayRef,
    showLandmarks
  });

  const confidencePercent = useMemo(
    () => Math.round((predictionState?.confidence || 0) * 100),
    [predictionState?.confidence]
  );

  const handleNote = (note, meta) => {
    setLastPlayedNote(note);
    setNoteHistory((prev) =>
      [{ note, meta, at: new Date().toISOString() }, ...prev].slice(0, 12)
    );
  };

  return (
    <div className="space-y-6 text-slate-100">
      <section className="rounded-[2rem] border border-[#00ff88]/20 bg-slate-950/85 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00ff88]/30 bg-[#00ff88]/10 px-3 py-1 text-xs text-[#8fffc7]">
              <Music2 size={12} />
              Virtual Piano Module
            </div>
            <h2 className="mt-2 text-3xl font-black">Premium Air Piano</h2>
            <p className="mt-1 text-sm text-slate-400">
              Separate module for gesture music interaction with real-time webcam tracking.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsTracking((prev) => !prev)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
            >
              <Camera size={14} className="mr-1 inline" />
              {isTracking ? 'Stop Camera' : 'Start Camera'}
            </button>
            <button
              onClick={() => setShowLandmarks((prev) => !prev)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
            >
              Landmarks: {showLandmarks ? 'On' : 'Off'}
            </button>
            <button
              onClick={() => setPianoEnabled((prev) => !prev)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                pianoEnabled ? 'bg-[#00ff88] text-slate-950' : 'border border-slate-700 text-slate-200'
              }`}
            >
              {pianoEnabled ? 'Piano Enabled' : 'Piano Disabled'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5">
          <div className="relative overflow-hidden rounded-[1.25rem] border border-slate-800 bg-black">
            <video ref={videoRef} muted playsInline className="aspect-video w-full scale-x-[-1] object-cover" />
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">Camera</p>
              <p className="mt-1 text-lg font-semibold text-white">{cameraStatus}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">Engine</p>
              <p className="mt-1 text-lg font-semibold text-white">{connectionStatus}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">Confidence</p>
              <p className="mt-1 text-lg font-semibold text-white">{confidencePercent}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Piano Controls</h3>
            <Activity size={16} className="text-[#00ff88]" />
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs uppercase tracking-widest text-slate-400">Mode</label>
            <select
              value={pianoMode}
              onChange={(event) => setPianoMode(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="piano">Piano</option>
              <option value="synth">Synth</option>
              <option value="drum">Drum</option>
            </select>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400">Last Note</p>
            <p className="mt-1 text-2xl font-black text-[#00ff88]">{lastPlayedNote || '—'}</p>
          </div>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Recent Notes</p>
            <div className="mt-2 space-y-2">
              {noteHistory.length ? (
                noteHistory.map((item, index) => (
                  <div key={`${item.at}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
                    <span className="font-semibold text-white">{item.note}</span>
                    <span className="ml-2 text-slate-400">({item.meta?.mode || pianoMode})</span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-400">
                  No notes triggered yet.
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-4">
        <VirtualPiano
          lastLandmarks={lastLandmarks}
          enabled={pianoEnabled && isTracking}
          mode={pianoMode}
          onNote={handleNote}
        />
      </section>
    </div>
  );
}
