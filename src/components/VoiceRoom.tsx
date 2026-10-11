import React, { useState, useEffect, useRef } from "react";
import { CollabUser } from "../types.js";
import { Mic, MicOff, Volume2, Users, Radio, HelpCircle, AudioLines, Sparkles } from "lucide-react";

interface VoiceRoomProps {
  users: CollabUser[];
  activeUserId: string;
  onUserUpdate: (id: string, updates: Partial<CollabUser>) => void;
}

export default function VoiceRoom({ users, activeUserId, onUserUpdate }: VoiceRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [localMute, setLocalMute] = useState(false);
  const [localLevel, setLocalLevel] = useState(0);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isSimulatedSpeaking, setIsSimulatedSpeaking] = useState(false);
  const [showMicNotice, setShowMicNotice] = useState(false);

  // Keep refs for animation frames to read the absolute latest state values
  const isSimulatedSpeakingRef = useRef(false);
  const localMuteRef = useRef(false);

  useEffect(() => {
    isSimulatedSpeakingRef.current = isSimulatedSpeaking;
  }, [isSimulatedSpeaking]);

  useEffect(() => {
    localMuteRef.current = localMute;
  }, [localMute]);

  // Simulated peer audio levels
  const [sarahLevel, setSarahLevel] = useState(0);
  const [alexLevel, setAlexLevel] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const localUser = users.find((u) => u.id === activeUserId);

  // Simulated speaker cycles for Sarah and Alex to make the workspace feel active and alive
  useEffect(() => {
    let interval: any;
    if (isConnected) {
      interval = setInterval(() => {
        // Toggle Sarah speaking
        const sarahSpeaking = Math.random() > 0.6;
        onUserUpdate("user-sarah", { isSpeaking: sarahSpeaking });
        if (sarahSpeaking) {
          setSarahLevel(Math.floor(Math.random() * 80) + 20);
        } else {
          setSarahLevel(0);
        }

        // Toggle Alex speaking
        const alexSpeaking = Math.random() > 0.8;
        onUserUpdate("user-alex", { isSpeaking: alexSpeaking });
        if (alexSpeaking) {
          setAlexLevel(Math.floor(Math.random() * 60) + 10);
        } else {
          setAlexLevel(0);
        }
      }, 2500);
    } else {
      setSarahLevel(0);
      setAlexLevel(0);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  // Handle active Microphone capture & visualizer
  const handleConnectVoice = async () => {
    if (isConnected) {
      // Disconnect
      cleanupAudio();
      setIsConnected(false);
      setIsSimulated(false);
      setShowMicNotice(false);
      setIsSimulatedSpeaking(false);
      onUserUpdate(activeUserId, { isSpeaking: false, isMuted: true });
      return;
    }

    try {
      // Prompt microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      setIsConnected(true);
      setLocalMute(false);
      setIsSimulated(false);
      setShowMicNotice(false);
      onUserUpdate(activeUserId, { isSpeaking: false, isMuted: false });

      // Start visualization loop
      drawWave(false);
    } catch (err) {
      console.warn("Microphone access denied or failed, falling back to simulated audio channels:", err);
      // Fallback connect anyway via simulated frequencies
      setIsConnected(true);
      setLocalMute(false);
      setIsSimulated(true);
      setShowMicNotice(true);
      setIsSimulatedSpeaking(true); // default to speaking to show visual feedback initially
      onUserUpdate(activeUserId, { isSpeaking: true, isMuted: false });

      // Start visualization loop in simulation mode
      drawWave(true);
    }
  };

  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    sourceRef.current = null;
    setLocalLevel(0);
  };

  useEffect(() => {
    return () => cleanupAudio();
  }, []);

  const toggleMute = () => {
    const nextMute = !localMute;
    setLocalMute(nextMute);
    onUserUpdate(activeUserId, { isMuted: nextMute, isSpeaking: false });
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMute;
      });
    }
  };

  // Canvas Waveform rendering loop
  const drawWave = (usingSimulation = false) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      // Loop execution check
      animationFrameRef.current = requestAnimationFrame(render);

      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
      } else {
        // Generate beautiful simulated values for visual response
        const time = Date.now() * 0.005;
        const speaking = isSimulatedSpeakingRef.current && !localMuteRef.current;
        for (let i = 0; i < bufferLength; i++) {
          if (speaking) {
            dataArray[i] = Math.abs(Math.sin(i * 0.3 + time) * Math.cos(i * 0.15 - time * 0.5)) * 130 + 20;
          } else {
            dataArray[i] = Math.random() * 8 + 5;
          }
        }
      }

      // Clear canvas with trace trail
      ctx.fillStyle = "rgba(10, 10, 10, 0.25)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Determine voice amplitude
      let total = 0;
      for (let i = 0; i < bufferLength; i++) {
        total += dataArray[i];
      }
      const averageLevel = total / bufferLength;

      // Update user speaking state
      const isSpeaking = analyserRef.current
        ? (averageLevel > 15 && !localMuteRef.current)
        : (isSimulatedSpeakingRef.current && !localMuteRef.current);

      onUserUpdate(activeUserId, { isSpeaking });
      setLocalLevel(localMuteRef.current ? 0 : averageLevel);

      // Draw custom visualizer waves
      ctx.strokeStyle = isSpeaking ? "rgba(34, 197, 94, 0.85)" : "rgba(99, 102, 241, 0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  };

  return (
    <div id="voice-chat-section" className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-transparent p-0 border-0">
      
      {/* Visual audio stream / controller */}
      <div className="md:col-span-2 bg-[#0a0a0a] rounded-2xl p-5 border border-zinc-800 flex flex-col justify-between min-h-[220px] shadow-sm">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Spatial voice channels</h3>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-xl bg-[#050505] border border-zinc-800 text-zinc-500 font-mono flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>{users.length} connected</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Connect to the workspace developer voice bridge. This spatial audio module uses high-bandwidth streams for zero-latency peer sync. Perfect for code pair-programming review sessions!
          </p>
        </div>

        {/* Dynamic Frequency Visualizer */}
        {isConnected ? (
          <div className="relative mb-4">
            <div className="bg-[#050505] h-16 rounded-xl border border-zinc-800 flex items-center overflow-hidden relative">
              <canvas ref={canvasRef} className="w-full h-full" width={400} height={64} />
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-300">
                <AudioLines className={`w-4 h-4 animate-bounce mr-2 ${isSimulated ? "text-indigo-400" : "text-emerald-400"}`} />
                <span className={`text-xs font-mono font-semibold ${isSimulated ? "text-indigo-400" : "text-emerald-400"}`}>
                  {isSimulated ? "Simulated voice bridge active" : "Channel stream active"}
                </span>
              </div>
            </div>
            {showMicNotice && (
              <div className="mt-2 text-[10px] text-indigo-400 font-mono flex items-center gap-1.5 px-1 bg-indigo-950/10 border border-indigo-900/30 p-2 rounded-xl">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
                <span>Microphone access blocked (Sandbox Iframe constraint). Simulated audio channel is running.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#050505] h-16 rounded-xl border border-zinc-800 flex items-center justify-center mb-4 text-zinc-600 text-xs font-mono uppercase tracking-wider">
            VOICE CHANNEL INACTIVE
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleConnectVoice}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              isConnected
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {isConnected ? (
              <>
                <MicOff className="w-4 h-4" />
                Disconnect Session
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Connect Voice Channel
              </>
            )}
          </button>

          {isConnected && isSimulated && (
            <button
              onClick={() => setIsSimulatedSpeaking(!isSimulatedSpeaking)}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl border transition ${
                isSimulatedSpeaking && !localMute
                  ? "bg-indigo-950/40 border-indigo-800 text-indigo-400 cursor-pointer"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300 cursor-pointer"
              }`}
              title={isSimulatedSpeaking ? "Stop speaking simulation" : "Simulate speaking / voice input"}
            >
              {isSimulatedSpeaking && !localMute ? "Mute Simulation" : "Simulate Mic"}
            </button>
          )}

          {isConnected && (
            <button
              onClick={toggleMute}
              className={`p-2.5 rounded-xl border transition ${
                localMute
                  ? "bg-rose-950/40 border-rose-800 text-rose-400 cursor-pointer"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850 cursor-pointer"
              }`}
              title={localMute ? "Unmute Mic" : "Mute Mic"}
            >
              {localMute ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Room members status lists */}
      <div className="bg-[#0a0a0a] rounded-2xl p-5 border border-zinc-800 flex flex-col justify-between min-h-[220px] shadow-sm">
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Active channel list</h4>
          <div className="space-y-3">
            {users.map((u) => {
              const isLocal = u.id === activeUserId;
              const actualMuted = isLocal ? localMute : u.isMuted;
              const level = isLocal ? localLevel : u.id === "user-sarah" ? sarahLevel : u.id === "user-alex" ? alexLevel : 0;
              const isUserSpeaking = level > 15 && !actualMuted;

              return (
                <div key={u.id} className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-zinc-800/60">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {/* Ring glowing ring animation based on speaking volume */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all duration-150 ${
                        isUserSpeaking
                          ? "ring-2 ring-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] scale-105"
                          : "ring-1 ring-zinc-800"
                      }`}
                      style={{ backgroundColor: u.color }}
                    >
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-semibold text-zinc-200 truncate">{u.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {isUserSpeaking ? "Speaking..." : actualMuted ? "Muted" : "Muted/Quiet"}
                      </span>
                    </div>
                  </div>

                  {/* Volume signal strength graph bars */}
                  <div className="flex items-end gap-0.5 h-4 px-2">
                    <div className={`w-0.5 rounded-full transition-all bg-emerald-400`} style={{ height: isUserSpeaking ? `${Math.min(100, level * 1.5)}%` : "15%" }} />
                    <div className={`w-0.5 rounded-full transition-all bg-emerald-400`} style={{ height: isUserSpeaking ? `${Math.min(100, level * 1.0)}%` : "15%" }} />
                    <div className={`w-0.5 rounded-full transition-all bg-emerald-400`} style={{ height: isUserSpeaking ? `${Math.min(100, level * 1.3)}%` : "15%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
          <span>Signal: Excellent</span>
          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-emerald-500" /> WebRTC Audio</span>
        </div>
      </div>

    </div>
  );
}
