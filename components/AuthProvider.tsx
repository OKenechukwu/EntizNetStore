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
    const getInitialSession = async () => {
      setLoading(true);
      try {
        await refreshProfile();
      } finally {
        setLoading(false);
      }
    };

    void getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await refreshProfile();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
