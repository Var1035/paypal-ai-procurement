import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { 
  Building2, 
  GraduationCap, 
  ChevronDown, 
  LogOut, 
  AlertCircle, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Eye, 
  EyeOff,
  Truck,
  Sparkles,
  ShieldCheck
} from "lucide-react";

export const AuthNavControls: React.FC = () => {
  const navigate = useNavigate();
  const { 
    user, 
    role, 
    activeSeller, 
    activeBuyer, 
    signInWithEmail,
    signUpWithEmail,
    signOut
  } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [isOpen, setIsOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [signupRole, setSignupRole] = useState<UserRole>("buyer");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [emailField, setEmailField] = useState("");
  const [passwordField, setPasswordField] = useState("");
  const [nameField, setNameField] = useState("");
  const [companyField, setCompanyField] = useState("");

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
        if (signupRole === "seller" && !companyField.trim()) {
          setAuthError("Please enter your supplier company/business name.");
          setAuthLoading(false);
          return;
        }

        const { error } = await signUpWithEmail(
          emailField, 
          passwordField, 
          nameField, 
          signupRole, 
          companyField.trim() || undefined
        );

        if (error) {
          setAuthError(error.message);
        } else {
          setAuthError(null);
          setIsOpen(false);
          setEmailField("");
          setPasswordField("");
          setNameField("");
          setCompanyField("");
          if (signupRole === "seller") {
            navigate("/seller");
          } else {
            navigate("/sourcing");
          }
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
          setCompanyField("");
        }
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const currentLabel = user 
    ? (role === "seller" ? (activeSeller?.name || "Seller") : (activeBuyer.name || "Buyer"))
    : "Sign In / Sign Up";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-medium transition-all cursor-pointer border ${
          user
            ? role === "seller"
              ? isDark
                ? "border-purple-500/40 bg-purple-950/40 text-purple-300 hover:bg-purple-900/40"
                : "border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100"
              : isDark
                ? "border-blue-500/40 bg-blue-950/40 text-blue-300 hover:bg-blue-900/40"
                : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
            : isDark
              ? "border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
        title="Account identity & authentication"
      >
        {user ? (
          role === "seller" ? (
            <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-500" />
          ) : (
            <GraduationCap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" />
          )
        ) : (
          <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
        )}

        {user && (
          <span className="font-semibold uppercase text-[9px] tracking-wider opacity-70 hidden md:inline">
            {role}:
          </span>
        )}
        <span className="max-w-[100px] sm:max-w-[140px] truncate font-semibold">
          {currentLabel}
        </span>
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute right-0 mt-2 w-72 sm:w-84 rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl z-50 transition-all ${
            isDark 
              ? "border-[#1E2638] bg-[#0A0F1D]/95 text-gray-100 shadow-[0_15px_40px_rgba(0,0,0,0.8)]" 
              : "border-slate-200 bg-white/95 text-slate-900 shadow-[0_15px_35px_rgba(0,0,0,0.12)]"
          }`}
        >
          {/* User Status Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-gray-400 block">
                {user ? "Authenticated Account" : "Access Portal"}
              </span>
              <span className="text-xs font-bold truncate block">
                {user?.email || "Guest Session"}
              </span>
            </div>
            {user ? (
              <span className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-mono font-semibold flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                Active
              </span>
            ) : (
              <span className="rounded bg-slate-500/10 border border-slate-500/20 text-slate-500 px-1.5 py-0.5 text-[9px] font-mono">
                Guest
              </span>
            )}
          </div>

          {/* LOGGED IN: Exclusively Display Own Account Info (Zero Other Accounts) */}
          {user ? (
            <div className="space-y-3 my-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#111728] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      role === "seller" 
                        ? "bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
                        : "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                    }`}>
                      {role === "seller" ? <Building2 className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {user.user_metadata?.full_name || (role === "seller" ? activeSeller?.name : activeBuyer.name)}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 block font-mono">
                        {user.email}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${
                    role === "seller"
                      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/30"
                      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30"
                  }`}>
                    {role === "seller" ? "Seller" : "Buyer"}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 dark:text-gray-300 flex items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-gray-800 font-medium">
                  <span className="text-slate-400 font-normal">
                    {role === "seller" ? "Supplier Company:" : "Organization:"}
                  </span>
                  <strong className="text-slate-900 dark:text-white truncate">
                    {role === "seller" 
                      ? (activeSeller?.name || user.user_metadata?.company_name || "Verified Supplier") 
                      : (activeBuyer.organization || user.user_metadata?.company_name || "Verified Enterprise")}
                  </strong>
                </div>
              </div>

              {/* Direct Role Section Shortcuts */}
              <div className="space-y-1.5">
                {role === "buyer" ? (
                  <>
                    <button
                      onClick={() => { navigate("/sourcing"); setIsOpen(false); }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-gray-200 bg-white hover:bg-slate-50 dark:bg-[#12192B] dark:hover:bg-[#1A233C] border border-slate-200 dark:border-gray-800 transition-all cursor-pointer shadow-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        <span>AI Sourcing & RFQs</span>
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                    </button>

                    <button
                      onClick={() => { navigate("/sourcing?tab=orders"); setIsOpen(false); }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-gray-200 bg-white hover:bg-slate-50 dark:bg-[#12192B] dark:hover:bg-[#1A233C] border border-slate-200 dark:border-gray-800 transition-all cursor-pointer shadow-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-emerald-500" />
                        <span>Order Status & Live Transit</span>
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { navigate("/seller"); setIsOpen(false); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-gray-200 bg-white hover:bg-slate-50 dark:bg-[#12192B] dark:hover:bg-[#1A233C] border border-slate-200 dark:border-gray-800 transition-all cursor-pointer shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-purple-500" />
                      <span>Seller Hub Dashboard</span>
                    </span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Sign Out */}
              <div className="pt-2 border-t border-slate-100 dark:border-gray-800">
                <button
                  onClick={() => {
                    signOut();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-300 py-2 px-3 text-xs font-semibold transition-all cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* GUEST MODE: Sign In / Sign Up with Role Selector */
            <div className="pt-3">
              {/* Auth Error Banner */}
              {authError && (
                <div className="mb-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-[11px] text-rose-800 dark:text-rose-300">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitAuth} className="space-y-3">
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

                {/* SIGNUP: Explicit Role Selection */}
                {authMode === "signup" && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-gray-400 uppercase block">
                      Choose Your Operating Account Type:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSignupRole("buyer")}
                        className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          signupRole === "buyer"
                            ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500"
                            : "border-slate-200 dark:border-gray-800 text-slate-600 dark:text-gray-400 hover:border-slate-300"
                        }`}
                      >
                        <GraduationCap className="h-4 w-4 mb-1 text-blue-500" />
                        <span className="text-xs font-bold block">Buyer Account</span>
                        <span className="text-[9px] text-slate-500 dark:text-gray-400">Procure & Sourcing</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSignupRole("seller")}
                        className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          signupRole === "seller"
                            ? "border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500"
                            : "border-slate-200 dark:border-gray-800 text-slate-600 dark:text-gray-400 hover:border-slate-300"
                        }`}
                      >
                        <Building2 className="h-4 w-4 mb-1 text-purple-500" />
                        <span className="text-xs font-bold block">Seller Account</span>
                        <span className="text-[9px] text-slate-500 dark:text-gray-400">Supplier & Catalog</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Name field (signup only) */}
                {authMode === "signup" && (
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={nameField}
                      onChange={(e) => setNameField(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192B] text-xs text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      required
                    />
                  </div>
                )}

                {/* Company Name (only if seller signup) */}
                {authMode === "signup" && signupRole === "seller" && (
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-500" />
                    <input
                      type="text"
                      placeholder="Supplier / Company Name"
                      value={companyField}
                      onChange={(e) => setCompanyField(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-purple-200 dark:border-purple-500/30 bg-purple-50/40 dark:bg-[#12192B] text-xs text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
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
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                    authMode === "signup" && signupRole === "seller"
                      ? "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30"
                      : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
                  }`}
                >
                  {authLoading ? (
                    <span className="animate-pulse">Processing...</span>
                  ) : (
                    <>
                      <span>{authMode === "signin" ? "Sign In" : `Create ${signupRole === "seller" ? "Seller" : "Buyer"} Account`}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default AuthNavControls;
