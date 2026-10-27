import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { 
  Building2, 
  GraduationCap, 
  ChevronDown, 
  LogOut, 
  Check, 
  AlertCircle
} from "lucide-react";

export const AuthNavControls: React.FC = () => {
  const { 
    user, 
    role, 
    switchRole, 
    activeSeller, 
    switchSeller, 
    availableSellers, 
    activeBuyer, 
    switchBuyer, 
    availableBuyers,
    signInWithGoogle, 
    signOut
  } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [isOpen, setIsOpen] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleError(error.message || "Google OAuth requires client ID in Supabase console. You can also use instant demo accounts below.");
    }
  };

  const currentLabel = role === "seller" 
    ? (activeSeller ? activeSeller.name : "Select Seller") 
    : (activeBuyer ? activeBuyer.name : "Select Buyer");

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-medium transition-all cursor-pointer border ${
          role === "seller"
            ? isDark
              ? "border-purple-500/40 bg-purple-950/40 text-purple-300 hover:bg-purple-900/40"
              : "border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100"
            : isDark
              ? "border-blue-500/40 bg-blue-950/40 text-blue-300 hover:bg-blue-900/40"
              : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
        }`}
        title="Manage active role and business identity"
      >
        {role === "seller" ? (
          <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-500" />
        ) : (
          <GraduationCap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" />
        )}
        <span className="font-semibold uppercase text-[9px] tracking-wider opacity-70 hidden md:inline">
          {role}:
        </span>
        <span className="max-w-[100px] sm:max-w-[130px] truncate font-semibold">
          {currentLabel}
        </span>
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl z-50 transition-all ${
            isDark 
              ? "border-[#1E2638] bg-[#0A0F1D]/95 text-gray-100 shadow-[0_15px_40px_rgba(0,0,0,0.8)]" 
              : "border-slate-200 bg-white/95 text-slate-900 shadow-[0_15px_35px_rgba(0,0,0,0.12)]"
          }`}
        >
          {/* User Status Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-gray-400 block">
                Active Authentication
              </span>
              <span className="text-xs font-bold truncate block">
                {user?.email || (user?.user_metadata?.full_name ? `${user.user_metadata.full_name}` : "Demo Guest Session")}
              </span>
            </div>
            {user && (
              <span className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono font-semibold">
                Google Verified
              </span>
            )}
          </div>

          {/* Role Switcher Pill */}
          <div className="my-3">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1.5">
              Select Active Operating Role:
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-gray-800">
              <button
                onClick={() => switchRole("seller")}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  role === "seller"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Seller Hub</span>
              </button>

              <button
                onClick={() => switchRole("buyer")}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  role === "buyer"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>Buyer Sourcing</span>
              </button>
            </div>
          </div>

          {/* Scoped Business / Persona Selection */}
          {role === "seller" ? (
            <div className="space-y-1.5 my-3">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-gray-400">
                <span>Select Seller Business (Scoped Data):</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">
                  {availableSellers.length} Registered
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {availableSellers.map((s) => {
                  const isSelected = activeSeller?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        switchSeller(s.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 font-bold text-purple-900 dark:text-purple-200"
                          : "border-transparent hover:bg-slate-100 dark:hover:bg-gray-800/60 text-slate-700 dark:text-gray-300"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="block truncate">{s.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-gray-400 block truncate font-mono">
                          {s.email ? `${s.email} • ` : ""}{s.category}
                        </span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 my-3">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-gray-400">
                <span>Select Buyer Account (Scoped Data):</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {availableBuyers.length} Profiles
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {availableBuyers.map((b) => {
                  const isSelected = activeBuyer?.name === b.name;
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        switchBuyer(b.name);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 font-bold text-blue-900 dark:text-blue-200"
                          : "border-transparent hover:bg-slate-100 dark:hover:bg-gray-800/60 text-slate-700 dark:text-gray-300"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="block truncate">{b.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-gray-400 block truncate">
                          {b.organization}
                        </span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Google OAuth Error Banner */}
          {googleError && (
            <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{googleError}</span>
              </div>
            </div>
          )}

          {/* Google Sign-in / Sign-out Action Bar */}
          <div className="pt-3 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between gap-2">
            {!user ? (
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-gray-700 bg-white hover:bg-slate-50 dark:bg-[#12192B] dark:hover:bg-[#1A233C] py-2 px-3 text-xs font-semibold transition-all cursor-pointer"
              >
                {/* Google G Logo SVG */}
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  signOut();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-300 py-2 px-3 text-xs font-semibold transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out ({user.email?.split("@")[0]})</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
