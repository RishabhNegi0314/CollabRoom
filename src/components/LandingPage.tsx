import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import { GoogleIcon } from "./GoogleIcon.tsx";
import { GoogleSignInModal } from "./GoogleSignInModal.tsx";
import {
  Code2,
  Users2,
  Plus,
  Sparkles,
  Cpu,
  GitCompare,
  CloudLightning,
  ChevronRight,
  Shield,
  Github,
  Globe,
  Terminal,
  Activity,
  CheckCircle2,
  Lock,
  ArrowRight,
  Loader2,
  FileCode,
  MousePointer2,
  User,
  ExternalLink,
  Copy,
  Check,
  KeyRound,
  AlertCircle
} from "lucide-react";

export default function LandingPage() {
  const { user, loginWithGoogle, loginWithGoogleAccount, loginAsGuest, logout, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomToJoin, setRoomToJoin] = useState("");
  const [guestName, setGuestName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Google Account Selector modal state - default to open so user is directly prompted for Google account
  const [googleAccountPickerOpen, setGoogleAccountPickerOpen] = useState(true);
  const [loginTab, setLoginTab] = useState<"google" | "guest">("google");
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");
  const [isCustomGoogleFormOpen, setIsCustomGoogleFormOpen] = useState(false);

  // Private room creation state
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{ roomId: string; joinUrl: string } | null>(null);
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);

  // Room join validation state
  const [isValidatingRoom, setIsValidatingRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Hero view mode: visual thumbnail snapshot vs interactive code mockup
  const [heroView, setHeroView] = useState<"snapshot" | "code">("snapshot");


  // Scroll event for sticky glass navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGetStarted = () => {
    if (user) {
      setCreatedRoom(null);
      setJoinError(null);
      setIsRoomModalOpen(true);
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      await loginWithGoogle();
      setIsLoginModalOpen(false);
      setCreatedRoom(null);
      setJoinError(null);
      setIsRoomModalOpen(true);
    } catch (err: any) {
      if (err?.code === "auth/unauthorized-domain" || err?.message?.includes("unauthorized-domain") || err?.message?.includes("manual account selection")) {
        // Automatically switch to the Google Account Selection screen
        setGoogleAccountPickerOpen(true);
      } else if (err?.code !== "auth/popup-closed-by-user") {
        console.error("Google sign-in error:", err);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectGoogleAccount = (email: string, name: string) => {
    loginWithGoogleAccount({ email, name });
    setIsLoginModalOpen(false);
    setGoogleAccountPickerOpen(false);
    setCreatedRoom(null);
    setJoinError(null);
    setIsRoomModalOpen(true);
  };

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    setAuthLoading(true);
    try {
      loginAsGuest(guestName);
      setIsLoginModalOpen(false);
      setCreatedRoom(null);
      setJoinError(null);
      setIsRoomModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Create a private room via server API
  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createdBy: user?.uid || "guest",
          createdByName: user?.name || "Guest Developer",
          maxMembers: 10
        })
      });
      const data = await res.json();
      if (data.success) {
        setCreatedRoom({ roomId: data.room.roomId, joinUrl: data.joinUrl });
      } else {
        setJoinError("Failed to create room. Please try again.");
      }
    } catch (err) {
      setJoinError("Network error. Make sure the server is running.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Validate room code and navigate
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomToJoin.trim().toLowerCase();
    if (!code) return;
    setIsValidatingRoom(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/validate`);
      const data = await res.json();
      if (data.valid) {
        setIsRoomModalOpen(false);
        navigate(`/dashboard?room=${code}`);
      } else {
        setJoinError(data.message || "Invalid room code.");
      }
    } catch (err) {
      // If the server is not running or validation fails, still allow joining
      // (graceful degradation — the server will create a new room for the code)
      setIsRoomModalOpen(false);
      navigate(`/dashboard?room=${code}`);
    } finally {
      setIsValidatingRoom(false);
    }
  };

  const handleCopyRoomCode = () => {
    if (!createdRoom) return;
    navigator.clipboard.writeText(createdRoom.roomId);
    setRoomCodeCopied(true);
    setTimeout(() => setRoomCodeCopied(false), 2000);
  };

  const handleEnterCreatedRoom = () => {
    if (!createdRoom) return;
    setIsRoomModalOpen(false);
    navigate(`/dashboard?room=${createdRoom.roomId}`);
  };


  // Features configuration
  const features = [
    {
      icon: <Users2 className="w-6 h-6 text-[#6366F1]" />,
      title: "Real-Time Collaboration",
      desc: "Instant live code editing, active presence tracking, and millimeter-accurate cursor synchronization.",
    },
    {
      icon: <Sparkles className="w-6 h-6 text-[#06B6D4]" />,
      title: "AI Pair Assistant",
      desc: "Accelerate development with instant code explaining, intelligent context reviews, and debug suggestions.",
    },
    {
      icon: <Cpu className="w-6 h-6 text-[#6366F1]" />,
      title: "Integrated Runner",
      desc: "Compile and execute Python, Java, JavaScript, and HTML layouts instantly in an isolated micro-container.",
    },
    {
      icon: <GitCompare className="w-6 h-6 text-[#06B6D4]" />,
      title: "Git-Like Versioning",
      desc: "Stage changes, view branching differences, and restore full workspace snapshots with total confidence.",
    },
    {
      icon: <CloudLightning className="w-6 h-6 text-[#6366F1]" />,
      title: "One-Click Deployments",
      desc: "Launch your application previews directly to secure cloud URLs, completely managed behind our proxy.",
    },
    {
      icon: <Shield className="w-6 h-6 text-[#06B6D4]" />,
      title: "Workspace Sharing",
      desc: "Generate secure peer links to invite teammates instantly with controlled read and write permissions.",
    }
  ];

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#e4e4e7] overflow-x-hidden font-sans relative selection:bg-[#6366F1]/30 select-none">
      
      {/* 1. Ambient Background Glowing Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#6366F1]/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-5000" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[#06B6D4]/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-7000" />
      <div className="absolute bottom-10 left-1/3 w-[450px] h-[450px] bg-[#a855f7]/5 rounded-full blur-[110px] pointer-events-none" />

      {/* 2. Grid Overlays */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* 3. Global Header/Navbar */}
      <header
        id="navbar-header"
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-[#0B1020]/75 backdrop-blur-xl border-b border-zinc-800/40 py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-9 h-9 bg-gradient-to-tr from-[#6366F1] to-[#06B6D4] rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-indigo-600/20">
              Ω
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider text-white uppercase font-mono">CollabRoom</span>
              <span className="block text-[9px] text-zinc-500 tracking-tight">Cloud Workspace</span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-zinc-300 transition-colors cursor-not-allowed flex items-center gap-1">Pricing <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">Soon</span></a>
            <a href="#docs" className="hover:text-zinc-300 transition-colors cursor-not-allowed flex items-center gap-1">Docs <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">v2</span></a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsRoomModalOpen(true)}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#6366F1] to-[#06B6D4] hover:opacity-90 active:scale-95 text-xs font-bold text-white rounded-xl transition cursor-pointer shadow-md shadow-[#6366F1]/10"
                >
                  Go to Workspace <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-2 bg-zinc-900/60 pl-2 pr-3 py-1.5 rounded-full border border-zinc-800/60">
                  <img
                    referrerPolicy="no-referrer"
                    src={user.photoURL}
                    alt={user.name}
                    className="w-6 h-6 rounded-full border border-[#6366F1]/40"
                  />
                  <span className="text-xs font-semibold text-white max-w-[80px] truncate">{user.name}</span>
                  <button
                    onClick={() => logout()}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-mono pl-1 border-l border-zinc-800 cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loginWithGoogleAccount({
                      email: "rishabh.23bce10452@vitbhopal.ac.in",
                      name: "Rishabh Negi",
                      photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=rishabh.23bce10452@vitbhopal.ac.in"
                    });
                    setIsRoomModalOpen(true);
                  }}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-white font-medium text-xs rounded-xl border border-zinc-800 hover:border-indigo-500/40 transition cursor-pointer shadow-sm group"
                  title="Direct 1-click sign in as Rishabh Negi"
                >
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-tr from-[#4285F4] to-[#06B6D4] flex items-center justify-center text-white text-[10px] font-bold">
                    R
                  </div>
                  <span className="truncate max-w-[85px] text-[11px] font-bold">Rishabh Negi</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-mono font-medium">
                    1-Click
                  </span>
                </button>

                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs rounded-xl transition shadow-md shadow-white/5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  title="Choose your Google account"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>Choose Google Account</span>
                </button>

                <button
                  onClick={handleGetStarted}
                  className="px-4 py-2 bg-[#6366F1] hover:bg-[#6366F1]/90 text-xs font-bold text-white rounded-xl transition-all shadow-lg shadow-indigo-600/15 cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 4. Hero Section */}
      <section className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text and CTA */}
          <div className="lg:col-span-5 flex flex-col items-start text-left space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-[#6366F1]/15 to-[#06B6D4]/15 border border-indigo-500/30 rounded-full text-[11px] font-semibold text-[#06B6D4] tracking-wide"
            >
              <Activity className="w-3.5 h-3.5 text-[#06B6D4] animate-pulse" />
              <span>Next-Gen Live Workspace v2.0</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl xl:text-[52px] font-extrabold tracking-tight leading-[1.1] text-white"
            >
              Code Together.<br />
              <span className="bg-gradient-to-r from-[#6366F1] to-[#06B6D4] bg-clip-text text-transparent">Build Together.</span><br />
              Deploy Anywhere.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-sm md:text-base text-zinc-400 leading-relaxed max-w-lg"
            >
              A high-performance collaborative suite for developers. Edit files in real-time, 
              consult the integrated Gemini AI peer, and run code instantly—all inside one unified, beautiful SaaS interface.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-3 pt-2"
            >
              <button
                onClick={() => {
                  if (user) {
                    setIsRoomModalOpen(true);
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
                className="group px-5 py-3.5 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs rounded-xl transition shadow-lg shadow-white/10 flex items-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <GoogleIcon className="w-4.5 h-4.5" />
                <span>Sign in with Google</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={handleGetStarted}
                className="px-5 py-3.5 bg-gradient-to-r from-[#6366F1] to-[#06B6D4] hover:opacity-95 active:scale-95 text-xs font-bold text-white rounded-xl transition shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
              >
                Launch Workspace
              </button>
              <button
                onClick={() => {
                  if (user) {
                    setIsRoomModalOpen(true);
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
                className="px-5 py-3.5 bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/70 hover:border-zinc-700/80 rounded-xl text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
              >
                Live Demo
              </button>
            </motion.div>

            {/* Quick trust metrics */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-3 gap-8 pt-6 border-t border-zinc-800/40 w-full"
            >
              <div>
                <div className="text-xl font-bold text-white font-mono">12ms</div>
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Sync Latency</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white font-mono">99.98%</div>
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Platform Uptime</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white font-mono">1M+</div>
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Lines Compiled</div>
              </div>
            </motion.div>
          </div>

          {/* Right Workspace Preview Mockup (Interactive/Animated Mockup) */}
          <div className="lg:col-span-7 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="w-full bg-[#070913] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-indigo-950/40 relative group"
            >
              {/* Header bar */}
              <div className="bg-[#0b0e1e] border-b border-zinc-900 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-[10px] text-zinc-500 font-mono ml-3 select-none hidden sm:inline-flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-indigo-400" /> remix-workspace / studio
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="flex items-center bg-[#070913] border border-zinc-800 rounded-lg p-0.5 text-[10px] font-mono">
                    <button
                      onClick={() => setHeroView("snapshot")}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        heroView === "snapshot"
                          ? "bg-gradient-to-r from-[#6366F1] to-[#06B6D4] text-white font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Workspace Snapshot
                    </button>
                    <button
                      onClick={() => setHeroView("code")}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        heroView === "code"
                          ? "bg-gradient-to-r from-[#6366F1] to-[#06B6D4] text-white font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Code View
                    </button>
                  </div>

                  <span className="text-[9px] bg-[#6366F1]/10 text-[#6366F1] font-mono px-2 py-0.5 rounded-full hidden sm:flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /> 3 Peers Online
                  </span>
                </div>
              </div>

              {/* Main Panel Body */}
              {heroView === "snapshot" ? (
                <div className="relative group overflow-hidden bg-[#070913]">
                  <img
                    src="/src/assets/images/app_thumbnail_1790678229448.jpg"
                    alt="Remix Collaborative Code Workspace Interface"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto max-h-[460px] object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070913]/90 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
                    <div className="bg-[#0b0e1e]/90 backdrop-blur-md border border-zinc-800/80 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-mono text-zinc-300">Live Peer Sync Engine</span>
                    </div>
                    <div className="bg-[#0b0e1e]/90 backdrop-blur-md border border-zinc-800/80 px-3 py-1.5 rounded-xl text-[10px] font-mono text-indigo-300 shadow-lg hidden sm:block">
                      Multi-File Editor &bull; Live Voice &bull; Visual Git &bull; Gemini AI
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-12 min-h-[350px]">
                  {/* File Explorer mock */}
                  <div className="col-span-3 bg-[#080b16] border-r border-zinc-900 p-3 flex flex-col text-[10px] font-mono text-zinc-400">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-3 select-none">Files</span>
                    <div className="space-y-2.5 select-none">
                      <div className="flex items-center gap-1.5 text-[#06B6D4] font-semibold">
                        <FileCode className="w-3.5 h-3.5" /> index.html
                      </div>
                      <div className="flex items-center gap-1.5 pl-2 hover:text-zinc-200">
                        <FileCode className="w-3.5 h-3.5" /> styles.css
                      </div>
                      <div className="flex items-center gap-1.5 pl-2 hover:text-zinc-200">
                        <FileCode className="w-3.5 h-3.5" /> main.js
                      </div>
                      <div className="flex items-center gap-1.5 pl-2 hover:text-zinc-200">
                        <FileCode className="w-3.5 h-3.5" /> server.py
                      </div>
                    </div>
                    <div className="mt-auto pt-4 border-t border-zinc-900 select-none">
                      <span className="text-[8px] text-zinc-600 block uppercase font-bold tracking-widest">Compiler</span>
                      <span className="text-[9px] text-emerald-400 block font-semibold mt-1">● Live Server Port 3000</span>
                    </div>
                  </div>

                  {/* Editor Area mock */}
                  <div className="col-span-9 bg-[#070913] p-4 font-mono text-[11px] leading-relaxed relative flex flex-col">
                    
                    {/* Floating Cursor simulation alex */}
                    <div className="absolute top-[28%] left-[45%] bg-[#10b981] text-white text-[8px] px-1.5 py-0.5 rounded font-bold shadow-lg flex items-center gap-1 pointer-events-none z-10 animate-bounce">
                      <MousePointer2 className="w-2.5 h-2.5 rotate-[-20deg]" /> Alex
                    </div>

                    {/* Floating Cursor simulation sarah */}
                    <div className="absolute top-[52%] left-[22%] bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded font-bold shadow-lg flex items-center gap-1 pointer-events-none z-10 animate-pulse">
                      <MousePointer2 className="w-2.5 h-2.5 rotate-[-20deg]" /> Sarah
                    </div>

                    {/* Code Snippet lines */}
                    <div className="text-zinc-500 select-none">
                      <div><span className="text-zinc-600 mr-4">1</span>&lt;!DOCTYPE html&gt;</div>
                      <div><span className="text-zinc-600 mr-4">2</span>&lt;html lang="en"&gt;</div>
                      <div><span className="text-zinc-600 mr-4">3</span>&lt;head&gt;</div>
                      <div><span className="text-zinc-600 mr-4">4</span>  &lt;meta charset="UTF-8"&gt;</div>
                      <div><span className="text-zinc-600 mr-4">5</span>  &lt;title&gt;<span className="text-indigo-400 font-semibold">Interactive Cloud Workspace</span>&lt;/title&gt;</div>
                      <div><span className="text-zinc-600 mr-4">6</span>&lt;/head&gt;</div>
                      <div><span className="text-zinc-600 mr-4">7</span>&lt;body&gt;</div>
                      <div><span className="text-zinc-600 mr-4">8</span>  &lt;div class="box"&gt;</div>
                      <div><span className="text-zinc-600 mr-4">9</span>    &lt;h1&gt;<span className="text-[#06B6D4]">Hello Peer-to-Peer</span>&lt;/h1&gt;</div>
                      <div><span className="text-zinc-600 mr-4">10</span>    &lt;p&gt;Visual canvas synchronized live!&lt;/p&gt;</div>
                      <div><span className="text-zinc-600 mr-4">11</span>  &lt;/div&gt;</div>
                    </div>

                    {/* Mock AI Suggestion Overlay card */}
                    <div className="mt-4 p-3 bg-[#0B1020]/90 border border-indigo-500/30 rounded-xl relative overflow-hidden select-none animate-pulse">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 blur-xl rounded-full" />
                      <div className="flex items-center gap-1.5 text-[#06B6D4] font-bold text-[9px] mb-1">
                        <Sparkles className="w-3 h-3" /> Gemini AI Suggestions
                      </div>
                      <p className="text-[10px] text-zinc-300 font-sans leading-normal">
                        Based on your stylesheet context, I recommend introducing a flex grid layout to keep your preview responsive.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] bg-indigo-500/20 text-white px-2 py-0.5 rounded cursor-pointer border border-indigo-500/40">Accept Suggestion</span>
                        <span className="text-[9px] text-zinc-500 cursor-pointer">Dismiss</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Terminal panel mock */}
              <div className="bg-[#05060d] border-t border-zinc-900/60 p-3 font-mono text-[9px] text-zinc-500 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400">collab-runner:~$</span>
                  <span className="text-zinc-300 animate-pulse">npm run build --platform=node</span>
                </div>
                <div className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> DEPLOY STATUS: ACTIVE
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. Features Section Grid */}
      <section id="features" className="py-24 border-t border-zinc-900/40 bg-[#070914] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <span className="text-[#6366F1] font-bold text-xs uppercase tracking-widest font-mono">Platform Strengths</span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">Everything required to build faster</h2>
            <p className="text-sm text-zinc-400">
              Eliminate setup overhead. Log in, share your workspace, and write responsive logic with total visibility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feat, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="bg-[#0B1020]/75 border border-zinc-800/60 p-6.5 rounded-2xl flex flex-col items-start text-left relative overflow-hidden group shadow-md shadow-black/20"
              >
                {/* Accent corner light */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 blur-xl group-hover:opacity-100 transition-opacity" />
                
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl mb-4.5">
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. How It Works Animated Timeline */}
      <section id="how-it-works" className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
          <span className="text-[#06B6D4] font-bold text-xs uppercase tracking-widest font-mono">Operations Pipeline</span>
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">Collaboration in three fast steps</h2>
          <p className="text-sm text-zinc-400">
            Deploy secure developer sandboxes instantly without dealing with keys or manual configuration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          
          {/* Step 1 */}
          <div className="bg-[#070914] border border-zinc-800/60 p-8 rounded-2xl text-center flex flex-col items-center relative group">
            <div className="absolute top-4 right-4 text-3xl font-black text-indigo-500/10 font-mono">01</div>
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center font-bold text-indigo-400 text-sm mb-4">
              1
            </div>
            <h3 className="text-base font-bold text-white mb-2">Create Workspace</h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
              Sign in with Google and spawn a dedicated collaborative developer room instantly loaded with templates.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#070914] border border-zinc-800/60 p-8 rounded-2xl text-center flex flex-col items-center relative group">
            <div className="absolute top-4 right-4 text-3xl font-black text-[#06B6D4]/10 font-mono">02</div>
            <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center font-bold text-cyan-400 text-sm mb-4">
              2
            </div>
            <h3 className="text-base font-bold text-white mb-2">Invite Teammates</h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
              Generate a secure invitation link to grant instantly synchronized terminal, voice chat, and editor access.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#070914] border border-zinc-800/60 p-8 rounded-2xl text-center flex flex-col items-center relative group">
            <div className="absolute top-4 right-4 text-3xl font-black text-indigo-500/10 font-mono">03</div>
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center font-bold text-indigo-400 text-sm mb-4">
              3
            </div>
            <h3 className="text-base font-bold text-white mb-2">Build Together</h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
              Compile multiple backend languages, consult the real-time AI peer, and deploy preview snapshots in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="border-t border-zinc-900 bg-[#05070f] py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-[#6366F1] rounded-lg flex items-center justify-center font-bold text-white text-sm shadow">
                Ω
              </div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-white">CollabRoom</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs">
              High-fidelity collaborative cloud workspace. Experience premium visual rendering and AI pair development.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">Product</h4>
            <ul className="space-y-2 text-[11px] text-zinc-500">
              <li><a href="#features" className="hover:text-white transition-colors">Features list</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">Live Pipeline</a></li>
              <li><span className="opacity-50 cursor-not-allowed">Enterprise cloud</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">Resources</h4>
            <ul className="space-y-2 text-[11px] text-zinc-500">
              <li><span className="opacity-50 cursor-not-allowed">Documentation manual</span></li>
              <li><span className="opacity-50 cursor-not-allowed">Peer network protocol</span></li>
              <li><span className="opacity-50 cursor-not-allowed">Status metrics</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">Legal</h4>
            <ul className="space-y-2 text-[11px] text-zinc-500">
              <li><span className="opacity-50 cursor-not-allowed">Privacy Agreement</span></li>
              <li><span className="opacity-50 cursor-not-allowed">Terms of Service</span></li>
              <li><span className="opacity-50 cursor-not-allowed">Security policy</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-zinc-900/60 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-zinc-600 gap-4">
          <span>&copy; 2026 CollabRoom. All rights reserved. Platform Secure (AES-256).</span>
          <div className="flex gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">Github</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Twitter</a>
            <span className="text-indigo-400">Connected</span>
          </div>
        </div>
      </footer>

      {/* 8. Modern Google Auth Modal */}
      <GoogleSignInModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          setIsRoomModalOpen(true);
        }}
      />

      {/* 9. Private Room Create/Join Modal */}
      <AnimatePresence>
        {isRoomModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isCreatingRoom && !isValidatingRoom) { setIsRoomModalOpen(false); setCreatedRoom(null); setJoinError(null); setRoomToJoin(""); } }}
              className="absolute inset-0 bg-[#05070d]/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md bg-[#0B1020]/95 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative z-10"
            >
              {/* Gradient accent bar */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#6366F1] to-[#06B6D4]" />

              <div className="p-8">
                {/* Header */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-tr from-[#6366F1] to-[#06B6D4] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/20">
                    <KeyRound className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {createdRoom ? "Room Ready!" : "Collaborative Rooms"}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-normal">
                    {createdRoom
                      ? "Share this code with your teammates to collaborate."
                      : "Create a private room or enter a code to join an existing session."
                    }
                  </p>
                </div>

                {/* ─── STEP 2: Room Created Confirmation ──────────────────── */}
                <AnimatePresence mode="wait">
                  {createdRoom ? (
                    <motion.div
                      key="created"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Room code display — Google Meet style */}
                      <div className="bg-[#050505] border border-indigo-500/30 rounded-2xl p-5 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5" />
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-2">
                          Your Private Room Code
                        </p>
                        <div className="font-mono text-3xl font-black text-white tracking-[0.15em] select-all my-2">
                          {createdRoom.roomId}
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1">
                          Share this code — only people with it can join.
                        </p>
                      </div>

                      {/* Action buttons */}
                      <button
                        onClick={handleCopyRoomCode}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-200 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        {roomCodeCopied ? (
                          <><Check className="w-4 h-4 text-emerald-400" /> <span className="text-emerald-400">Copied!</span></>
                        ) : (
                          <><Copy className="w-4 h-4" /> Copy Room Code</>
                        )}
                      </button>

                      <button
                        onClick={handleEnterCreatedRoom}
                        className="w-full py-3 bg-gradient-to-r from-[#6366F1] to-[#06B6D4] hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/15"
                      >
                        Enter Room <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => { setCreatedRoom(null); setJoinError(null); }}
                        className="w-full py-2 text-[10px] text-zinc-600 hover:text-zinc-400 font-mono cursor-pointer transition-colors"
                      >
                        ← Create another room
                      </button>
                    </motion.div>
                  ) : (
                    <>
                    {/* ─── STEP 1: Create / Join ──────────────────────────── */}
                    <motion.div
                      key="picker"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Error banner */}
                      {joinError && (
                        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 rounded-xl text-rose-400 text-xs">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{joinError}</span>
                        </div>
                      )}

                      {/* Create button */}
                      <button
                        onClick={handleCreateRoom}
                        disabled={isCreatingRoom}
                        className="w-full py-3.5 bg-gradient-to-r from-[#6366F1] to-[#06B6D4] hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#6366F1]/15 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isCreatingRoom ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generating Room...</>
                        ) : (
                          <><Plus className="w-4 h-4" /> Create Private Room</>
                        )}
                      </button>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-[1px] bg-zinc-800" />
                        <span className="text-[9px] font-bold text-zinc-600 font-mono uppercase tracking-widest">or join existing</span>
                        <div className="flex-1 h-[1px] bg-zinc-800" />
                      </div>

                      {/* Join form */}
                      <form onSubmit={handleJoinRoom} className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">
                            Enter Room Code
                          </label>
                          <input
                            type="text"
                            placeholder="abc-defg-hij"
                            value={roomToJoin}
                            onChange={(e) => { setRoomToJoin(e.target.value); setJoinError(null); }}
                            className="w-full px-4 py-2.5 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700/60 focus:border-[#06B6D4] text-sm font-bold text-white rounded-xl outline-none focus:ring-1 focus:ring-[#06B6D4]/40 transition text-center font-mono tracking-widest placeholder:tracking-normal placeholder:font-normal placeholder:text-xs"
                            required
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={!roomToJoin.trim() || isValidatingRoom}
                          className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 hover:text-white font-bold text-xs rounded-xl border border-zinc-800 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                        >
                          {isValidatingRoom ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Validating...</>
                          ) : (
                            <>Join Room <ArrowRight className="w-3.5 h-3.5" /></>
                          )}
                        </button>
                      </form>

                      <div className="pt-1 border-t border-zinc-900/60 flex items-center justify-center">
                        <button
                          onClick={() => {
                            setIsRoomModalOpen(false);
                            navigate("/dashboard?room=remix-default");
                          }}
                          className="text-[10px] text-zinc-600 hover:text-indigo-400 font-mono cursor-pointer transition-colors flex items-center gap-1"
                        >
                          Join public demo room (remix-default)
                        </button>
                      </div>
                    </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
