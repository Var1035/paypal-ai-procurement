import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/services/apiClient";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "seller" | "buyer";

export interface ActiveSellerBusiness {
  id: string;
  name: string;
  category: string;
  email: string;
  regNo?: string;
  gstin?: string;
  isVerified?: boolean;
}

export interface ActiveBuyerProfile {
  id: string;
  name: string;
  email: string;
  organization: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  switchRole: (role: UserRole) => void;
  
  // Seller Context
  activeSeller: ActiveSellerBusiness | null;
  switchSeller: (businessId: string) => void;
  availableSellers: ActiveSellerBusiness[];
  refreshSellers: () => Promise<void>;

  // Buyer Context
  activeBuyer: ActiveBuyerProfile;
  switchBuyer: (buyerName: string) => void;
  availableBuyers: ActiveBuyerProfile[];

  // Auth Operations (email + password)
  signUpWithEmail: (
    email: string, 
    password: string, 
    fullName: string, 
    accountRole: UserRole, 
    companyName?: string
  ) => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loginDemoPersona: (role: UserRole, idOrName: string) => void;
}

const DEFAULT_BUYERS: ActiveBuyerProfile[] = [
  { id: "buyer-st-jude", name: "St. Jude Academy", email: "procure@stjude.edu", organization: "K-12 Educational District" },
  { id: "buyer-metro-health", name: "Metro Health Network", email: "supplies@metrohealth.org", organization: "Healthcare Provider" },
  { id: "buyer-apex-tech", name: "Apex Tech Labs", email: "facilities@apextech.io", organization: "Commercial Enterprise" },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Role: defaults to 'seller' or 'buyer' (persisted in localStorage)
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem("agentmarket_user_role") as UserRole) || "seller";
  });

  // Available Sellers fetched from Supabase
  const [availableSellers, setAvailableSellers] = useState<ActiveSellerBusiness[]>([]);
  const availableSellersRef = useRef<ActiveSellerBusiness[]>([]);
  availableSellersRef.current = availableSellers;
  const [activeSeller, setActiveSeller] = useState<ActiveSellerBusiness | null>(null);

  // Active Buyer Profile
  const [activeBuyer, setActiveBuyer] = useState<ActiveBuyerProfile>(() => {
    const saved = localStorage.getItem("agentmarket_active_buyer");
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_BUYERS[0];
  });

  // Fetch all registered businesses from Supabase
  const refreshSellers = useCallback(async () => {
    try {
      const res = await api.getSuppliers();
      if (res?.suppliers && res.suppliers.length > 0) {
        const mapped: ActiveSellerBusiness[] = res.suppliers.map((s: any) => ({
          id: s.id,
          name: s.name,
          category: s.category || "General",
          email: s.email || "supplier@enterprise.com",
          regNo: s.reg_no,
          gstin: s.gstin,
          isVerified: s.is_verified,
        }));
        setAvailableSellers(mapped);
        availableSellersRef.current = mapped;

        // Priority selection:
        // 1. Matched seller by authenticated user email
        // 2. Saved seller in localStorage
        // 3. First seller in list
        const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        const currentEmail = session?.user?.email?.toLowerCase();
        
        let found: ActiveSellerBusiness | undefined;
        if (currentEmail) {
          found = mapped.find((s) => s.email?.toLowerCase() === currentEmail);
        }
        if (!found) {
          const savedSellerId = localStorage.getItem("agentmarket_active_seller_id");
          if (savedSellerId) {
            found = mapped.find((s) => s.id === savedSellerId);
          }
        }
        if (!found) {
          found = mapped[0];
        }

        if (found) {
          setActiveSeller(found);
          localStorage.setItem("agentmarket_active_seller_id", found.id);
        }
      }
    } catch {
      // Fallback seller businesses if offline
      const fallbacks: ActiveSellerBusiness[] = [
        { id: "varun-furni-1", name: "Varun Furni", category: "Commercial & Institutional Furniture", email: "22et0003@gmail.com" },
        { id: "deskworks-1", name: "DeskWorks", category: "Classroom Desks", email: "sales@deskworks.com" },
        { id: "furniturehub-1", name: "FurnitureHub", category: "Commercial Workstations", email: "orders@furniturehub.com" },
      ];
      setAvailableSellers(fallbacks);
      availableSellersRef.current = fallbacks;
      setActiveSeller(fallbacks[0]);
    }
  }, []);

  // Listen to Supabase Auth State Changes
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            const meta = initialSession.user.user_metadata;
            const userRole: UserRole = meta?.role === "seller" ? "seller" : "buyer";
            setRole(userRole);
            localStorage.setItem("agentmarket_user_role", userRole);

            if (userRole === "seller") {
              const company = meta?.company_name || meta?.full_name || initialSession.user.email?.split("@")[0] || "My Supplier Business";
              const userEmail = initialSession.user.email?.toLowerCase();
              const pool = availableSellersRef.current;
              const matchedSeller = pool.find((s) => s.email?.toLowerCase() === userEmail);
              if (matchedSeller) {
                setActiveSeller(matchedSeller);
                localStorage.setItem("agentmarket_active_seller_id", matchedSeller.id);
              } else {
                const sObj: ActiveSellerBusiness = {
                  id: initialSession.user.id,
                  name: company,
                  category: "Commercial Supplier",
                  email: initialSession.user.email || "",
                  isVerified: true
                };
                setActiveSeller(sObj);
                localStorage.setItem("agentmarket_active_seller_id", sObj.id);
              }
            } else {
              setActiveBuyer({
                id: initialSession.user.id,
                name: meta?.full_name || initialSession.user.email?.split("@")[0] || "Authenticated Buyer",
                email: initialSession.user.email || "buyer@domain.com",
                organization: meta?.company_name || "Enterprise Procurement",
              });
            }
          }
        }
      } catch (err) {
        console.warn("Supabase auth check error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();
    refreshSellers();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        const meta = currentSession.user.user_metadata;
        const userRole: UserRole = meta?.role === "seller" ? "seller" : "buyer";
        setRole(userRole);
        localStorage.setItem("agentmarket_user_role", userRole);

        if (userRole === "seller") {
          const company = meta?.company_name || meta?.full_name || currentSession.user.email?.split("@")[0] || "My Supplier Business";
          const userEmail = currentSession.user.email?.toLowerCase();
          const pool = availableSellersRef.current;
          const matchedSeller = pool.find((s) => s.email?.toLowerCase() === userEmail);
          if (matchedSeller) {
            setActiveSeller(matchedSeller);
            localStorage.setItem("agentmarket_active_seller_id", matchedSeller.id);
          } else {
            const sObj: ActiveSellerBusiness = {
              id: currentSession.user.id,
              name: company,
              category: "Commercial Supplier",
              email: currentSession.user.email || "",
              isVerified: true
            };
            setActiveSeller(sObj);
            localStorage.setItem("agentmarket_active_seller_id", sObj.id);
          }
        } else {
          setActiveBuyer({
            id: currentSession.user.id,
            name: meta?.full_name || currentSession.user.email?.split("@")[0] || "Authenticated Buyer",
            email: currentSession.user.email || "buyer@domain.com",
            organization: meta?.company_name || "Enterprise Procurement",
          });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshSellers]);

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem("agentmarket_user_role", newRole);
  };

  const switchSeller = (businessId: string) => {
    const found = availableSellers.find((s) => s.id === businessId);
    if (found) {
      setActiveSeller(found);
      localStorage.setItem("agentmarket_active_seller_id", found.id);
    }
  };

  const switchBuyer = (buyerName: string) => {
    const found = DEFAULT_BUYERS.find((b) => b.name === buyerName);
    if (found) {
      setActiveBuyer(found);
      localStorage.setItem("agentmarket_active_buyer", JSON.stringify(found));
    }
  };

  const signUpWithEmail = async (
    email: string, 
    password: string, 
    fullName: string,
    accountRole: UserRole,
    companyName?: string
  ): Promise<{ error: Error | null }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            full_name: fullName,
            role: accountRole,
            company_name: companyName || fullName
          },
        },
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      // Persist chosen role immediately
      switchRole(accountRole);

      if (accountRole === "seller") {
        const businessName = companyName || fullName;
        // Register seller in business directory
        try {
          await api.registerSupplier({
            name: businessName,
            email: email,
            category: "Commercial & Institutional Furniture",
          });
        } catch (regErr) {
          console.warn("Supplier auto-registration notice:", regErr);
        }

        const newSeller: ActiveSellerBusiness = {
          id: data.user?.id || `seller-${Date.now()}`,
          name: businessName,
          category: "Commercial & Institutional Furniture",
          email: email,
          isVerified: true
        };
        setActiveSeller(newSeller);
        localStorage.setItem("agentmarket_active_seller_id", newSeller.id);
      } else {
        const newBuyer: ActiveBuyerProfile = {
          id: data.user?.id || `buyer-${Date.now()}`,
          name: fullName,
          email: email,
          organization: companyName || "Enterprise Procurement",
        };
        setActiveBuyer(newBuyer);
        localStorage.setItem("agentmarket_active_buyer", JSON.stringify(newBuyer));
      }

      return { error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error("Failed to create account") };
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error("Failed to sign in") };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const loginDemoPersona = (targetRole: UserRole, idOrName: string) => {
    switchRole(targetRole);
    if (targetRole === "seller") {
      const found = availableSellers.find((s) => s.id === idOrName || s.name === idOrName);
      if (found) {
        setActiveSeller(found);
        localStorage.setItem("agentmarket_active_seller_id", found.id);
      }
    } else {
      const found = DEFAULT_BUYERS.find((b) => b.id === idOrName || b.name === idOrName);
      if (found) {
        setActiveBuyer(found);
        localStorage.setItem("agentmarket_active_buyer", JSON.stringify(found));
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        switchRole,
        activeSeller,
        switchSeller,
        availableSellers,
        refreshSellers,
        activeBuyer,
        switchBuyer,
        availableBuyers: DEFAULT_BUYERS,
        signUpWithEmail,
        signInWithEmail,
        signOut,
        loginDemoPersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
