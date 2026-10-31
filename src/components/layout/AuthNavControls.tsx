import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { 
  Building2, 
  GraduationCap, 
  ChevronDown, 
  LogOut, 
  Check, 
  AlertCircle,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff
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
    signInWithEmail,
    signUpWithEmail,
    signOut
  } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [isOpen, setIsOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [emailField, setEmailField] = useState("");
  const [passwordField, setPasswordField] = useState("");
  const [nameField, setNameField] = useState("");

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

  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        if (!nameField.trim()) {
          setAuthError("Please enter your full name.");
          setAuthLoading(false);
          return;
        }
        const { error } = await signUpWithEmail(emailField, passwordField, nameField);
        if (error) {
          setAuthError(error.message);
        } else {
          setAuthError(null);
          // Supabase may require email confirmation; show success
          setAuthMode("signin");
          setPasswordField("");
        }
      } else {
        const { error } = await signInWithEmail(emailField, passwordField);
        if (error) {
          setAuthError(error.message);
        } else {
          setIsOpen(false);
          setEmailField("");
          setPasswordField("");
          setNameField("");
        }
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
    } finally {
      setAuthLoading(false);
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
                {user?.email || (user?.user_metadata?.full_name ? `${user.user_metadata.full_name}` : "Guest Session")}
              </span>
            </div>
            {user && (
              <span className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono font-semibold">
                Verified
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

          {/* Auth Error Banner */}
          {authError && (
            <div className="mb-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-[11px] text-rose-800 dark:text-rose-300">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            </div>
          )}

          {/* Sign In / Sign Up / Sign Out */}
          <div className="pt-3 border-t border-slate-100 dark:border-gray-800">
            {!user ? (
              <form onSubmit={handleSubmitAuth} className="space-y-2.5">
                {/* Mode Tabs */}
                <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-gray-800 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => { setAuthMode("signin"); setAuthError(null); }}
                    className={`flex-1 py-1.5 text-center transition-colors cursor-pointer ${
                      authMode === "signin"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-50 dark:bg-[#12192B] text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("signup"); setAuthError(null); }}
                    className={`flex-1 py-1.5 text-center transition-colors cursor-pointer ${
                      authMode === "signup"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-50 dark:bg-[#12192B] text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Name field (signup only) */}
                {authMode === "signup" && (
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={nameField}
                      onChange={(e) => setNameField(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192B] text-xs text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      required
                    />
                  </div>
                )}

                {/* Email */}
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={emailField}
                    onChange={(e) => setEmailField(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192B] text-xs text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    required
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={passwordField}
                    onChange={(e) => setPasswordField(e.target.value)}
                    className="w-full pl-8 pr-9 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192B] text-xs text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2 px-3 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {authLoading ? (
                    <span className="animate-pulse">Processing...</span>
                  ) : (
                    <>
                      <span>{authMode === "signin" ? "Sign In" : "Create Account"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
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
