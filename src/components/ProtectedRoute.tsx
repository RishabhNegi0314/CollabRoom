import React, { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Reactively redirect to landing page when user logs out (user transitions to null)
  useEffect(() => {
    if (!loading && !user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1020] text-zinc-300 flex flex-col items-center justify-center relative font-sans select-none overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#6366F1]/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-5000" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-[#06B6D4]/10 rounded-full blur-[80px] pointer-events-none animate-pulse duration-7000" />

        <div className="flex flex-col items-center gap-4 z-10">
          <div className="w-12 h-12 bg-gradient-to-tr from-[#6366F1] to-[#06B6D4] rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-600/20 mb-2">
            Ω
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 bg-zinc-900/40 border border-zinc-800/50 rounded-xl">
            <Loader2 className="w-4 h-4 text-[#06B6D4] animate-spin" />
            <span className="text-xs font-semibold tracking-wider text-zinc-300 uppercase font-mono">
              Verifying Session...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect unauthenticated users back to the landing page
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

