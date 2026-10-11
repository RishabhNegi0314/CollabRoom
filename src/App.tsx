import React, { ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import LandingPage from "./components/LandingPage.tsx";
import Dashboard from "./components/Dashboard.tsx";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// React 19 Error Boundary typed safely
class ErrorBoundary extends (React.Component as new (props: any) => {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState;
  setState: (state: Partial<ErrorBoundaryState>) => void;
}) {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Unhandled React Error in App:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-6">
            <span className="text-2xl font-bold text-indigo-400">Ω</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight mb-2 text-white">
            Workspace Recovery Mode
          </h1>
          <p className="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
            The workspace encountered an unexpected runtime state. You can reload the application or return to the main dashboard.
          </p>
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 max-w-lg w-full text-left font-mono text-[11px] text-rose-400 mb-6 overflow-x-auto">
            {this.state.error?.message || "Unknown runtime error occurred"}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
            >
              Reload Application
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs rounded-xl border border-zinc-800 transition cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
