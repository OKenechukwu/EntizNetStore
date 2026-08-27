'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getCurrentUser,
  getBuyerProfile,
  getSellerProfile,
  getBusinessProfile,
  type AuthUser,
  type UserRole,
} from '@/lib/auth';

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setUser(null);
        return;
      }

      const [sellerProfile, businessProfile, buyerProfile] = await Promise.allSettled([
        getSellerProfile(currentUser.id),
        getBusinessProfile(currentUser.id),
        getBuyerProfile(currentUser.id),
      ]);

      const seller = sellerProfile.status === 'fulfilled' ? sellerProfile.value : null;
      const business = businessProfile.status === 'fulfilled' ? businessProfile.value : null;
      const buyer = buyerProfile.status === 'fulfilled' ? buyerProfile.value : null;
      const isAdmin = currentUser.app_metadata?.role === 'admin';

      // `role` is only the default presentation. Permission-bearing identity is
      // retained in the additive flags and verified again on trusted APIs.
      const role: UserRole = isAdmin ? 'admin' : seller ? 'seller' : business ? 'bsm' : 'buyer';
      const profile = seller || business || buyer;

      setUser({
        id: currentUser.id,
        email: currentUser.email!,
        role,
        profile: profile || undefined,
        isAdmin,
        isBuyer: !!buyer,
        isSeller: !!seller,
        isBusiness: !!business,
      });
    } catch (error) {
      console.error('Error refreshing profile:', error);
      setUser(null);
    }
  };

  useEffect(() => {
    let active = true;

    // The explicit initial hydration owns the initial `loading` lifecycle.
    // Supabase also emits INITIAL_SESSION when the auth listener is registered.
    // That event must not independently set `loading` to false: it can arrive
    // before the profile/capability queries below finish and briefly expose
    // `user === null` to protected client routes, causing valid sessions to be
    // redirected to sign-in. This race was reproduced by the authenticated
    // Chromium release gate on /dashboard/profile.
    const hydrateInitialUser = async () => {
      setLoading(true);
      try {
        await refreshProfile();
      } finally {
        if (active) setLoading(false);
      }
    };

    void hydrateInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || !session) {
        // Ignore INITIAL_SESSION here. The explicit initial hydration above is
        // authoritative for both authenticated and anonymous first load.
        if (event !== 'INITIAL_SESSION') {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      // INITIAL_SESSION with a session is deliberately ignored for the same
      // reason: initial hydration already owns it. Subsequent auth changes are
      // re-hydrated and keep the route guarded until capability state is ready.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setLoading(true);
        void refreshProfile().finally(() => {
          if (active) setLoading(false);
        });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
