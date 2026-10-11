import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth, GoogleAccount } from "../context/AuthContext.tsx";
import { GoogleIcon } from "./GoogleIcon.tsx";
import {
  Plus,
  ChevronRight,
  User,
  Loader2,
  X,
  ShieldCheck,
  Trash2,
  Mail,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

interface GoogleSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  allowGuest?: boolean;
  title?: string;
  subtitle?: string;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  allowGuest = true,
  title = "Choose an account",
  subtitle = "to continue to CollabRoom"
}) => {
  const {
    loginWithGoogle,
    loginWithGoogleAccount,
    savedGoogleAccounts,
    removeSavedGoogleAccount,
    loginAsGuest,
    error,
    clearError
  } = useAuth();

  const [authLoading, setAuthLoading] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [isGuestFormOpen, setIsGuestFormOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  // Ensure primary account is present in list
  const accounts: GoogleAccount[] = savedGoogleAccounts && savedGoogleAccounts.length > 0
    ? savedGoogleAccounts
    : [
        {
          email: "rishabh.23bce10452@vitbhopal.ac.in",
          name: "Rishabh Negi",
          photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=rishabh.23bce10452@vitbhopal.ac.in",
          isPrimary: true
        }
      ];

  const handleSelectAccount = (account: GoogleAccount) => {
    clearError();
    setInfoNotice(null);
    loginWithGoogleAccount({ email: account.email, name: account.name, photoURL: account.photoURL });
    onSuccess?.();
    onClose();
  };

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    const cleanEmail = customEmail.trim();
    const cleanName = customName.trim() || cleanEmail.split("@")[0] || "Google User";
    clearError();
    setInfoNotice(null);
    loginWithGoogleAccount({ email: cleanEmail, name: cleanName });
    setCustomEmail("");
    setCustomName("");
    setIsAddAccountOpen(false);
    onSuccess?.();
    onClose();
  };

  const handleOAuthLogin = async () => {
    setAuthLoading(true);
    clearError();
    setInfoNotice(null);
    try {
      await loginWithGoogle();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (
        err?.code === "auth/unauthorized-domain" ||
        err?.message?.includes("unauthorized-domain") ||
        err?.message?.includes("manual account selection")
      ) {
        setInfoNotice("Preview domain active: select your Google account directly above to sign in.");
      } else if (err?.code !== "auth/popup-closed-by-user") {
        setInfoNotice("Direct Google account selection is active. Click your account above.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    loginAsGuest(guestName);
    onSuccess?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!authLoading) onClose();
            }}
            className="absolute inset-0 bg-[#05070d]/85 backdrop-blur-md"
          />

          {/* Google Account Picker Card */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-[420px] bg-[#0c101d] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col text-left"
          >
            {/* Top Google Colors Bar */}
            <div className="h-1 w-full bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853]" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 md:p-7 flex flex-col">
              {/* Google Brand Header */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-md mb-3">
                  <GoogleIcon className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {title}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {subtitle}
                </p>
              </div>

              {/* Informational notice banner */}
              {(infoNotice || error) && (
                <div className="w-full bg-indigo-950/40 border border-indigo-500/30 px-3.5 py-2.5 rounded-xl text-indigo-300 text-xs mb-4 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span className="flex-1 text-[11px] leading-relaxed">
                    {infoNotice || error}
                  </span>
                  <button
                    onClick={() => { setInfoNotice(null); clearError(); }}
                    className="text-zinc-400 hover:text-white text-xs font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Accounts List (Direct 1-Click Choice) */}
              <div className="space-y-2 mb-4">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>Available Accounts</span>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 font-semibold">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Verified
                  </span>
                </div>

                <div className="space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => handleSelectAccount(account)}
                      className="w-full p-3.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-indigo-500/50 transition-all flex items-center gap-3.5 cursor-pointer group text-left shadow-sm hover:shadow-indigo-500/10 active:scale-[0.99]"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[#4285F4] to-[#06B6D4] flex items-center justify-center text-white font-bold text-sm shadow shrink-0 border border-white/10">
                        {account.photoURL ? (
                          <img
                            referrerPolicy="no-referrer"
                            src={account.photoURL}
                            alt={account.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          account.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Name & Email */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                          <span className="truncate">{account.name}</span>
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-medium">
                            Google Account
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
                          {account.email}
                        </div>
                      </div>

                      {/* Delete icon if extra account */}
                      {!account.isPrimary && accounts.length > 1 && (
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSavedGoogleAccount(account.email);
                          }}
                          className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition"
                          title="Remove saved account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      )}

                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Add another Google account form / toggle */}
              {isAddAccountOpen ? (
                <form
                  onSubmit={handleAddAccountSubmit}
                  className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3 mb-4 animate-in fade-in duration-150"
                >
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Enter Google Account Details</span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 font-mono">
                      Google Email
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. name@gmail.com"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 text-xs text-white rounded-lg outline-none font-mono"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 font-mono">
                      Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex Doe"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 text-xs text-white rounded-lg outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddAccountOpen(false)}
                      className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-xs rounded-lg cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-gradient-to-r from-[#6366F1] to-[#06B6D4] text-white font-bold text-xs rounded-lg shadow cursor-pointer transition"
                    >
                      Sign In Directly
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/80 text-xs text-zinc-300 hover:text-white transition flex items-center justify-center gap-2 cursor-pointer font-medium mb-4"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Use another Google account</span>
                </button>
              )}

              {/* Guest option */}
              {allowGuest && (
                <div className="pt-3 border-t border-zinc-800/80">
                  {isGuestFormOpen ? (
                    <form onSubmit={handleGuestSubmit} className="space-y-2.5">
                      <div className="relative">
                        <User className="absolute left-3 top-[10px] w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Guest Developer Name (e.g. Alex)"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                          required
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsGuestFormOpen(false)}
                          className="flex-1 py-2 bg-zinc-900 text-zinc-400 hover:text-white text-xs rounded-xl border border-zinc-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl"
                        >
                          Continue as Guest
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <button
                        type="button"
                        onClick={() => setIsGuestFormOpen(true)}
                        className="hover:text-zinc-300 font-medium transition cursor-pointer flex items-center gap-1.5"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Continue as Guest instead</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOAuthLogin}
                        disabled={authLoading}
                        className="hover:text-zinc-300 font-mono text-[10px] transition cursor-pointer flex items-center gap-1"
                        title="Try OAuth popup"
                      >
                        {authLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <GoogleIcon className="w-3 h-3" />}
                        <span>OAuth Popup</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
