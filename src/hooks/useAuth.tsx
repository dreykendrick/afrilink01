import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: 'vendor' | 'affiliate' | null;
  availableRoles: ('vendor' | 'affiliate')[];
  signOut: () => Promise<void>;
  switchRole: (newRole: 'vendor' | 'affiliate') => Promise<boolean>;
  addRole: (newRole: 'vendor' | 'affiliate') => Promise<boolean>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'vendor' | 'affiliate' | null>(null);
  const [availableRoles, setAvailableRoles] = useState<('vendor' | 'affiliate')[]>([]);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user roles:', error);
        return;
      }

      const roles = (data || []).map(r => r.role as 'vendor' | 'affiliate');
      setAvailableRoles(roles);

      // Get the active role from localStorage or default to first role
      const savedRole = localStorage.getItem(`afrilink_active_role_${userId}`);
      if (savedRole && roles.includes(savedRole as 'vendor' | 'affiliate')) {
        setUserRole(savedRole as 'vendor' | 'affiliate');
      } else if (roles.length > 0) {
        setUserRole(roles[0]);
        localStorage.setItem(`afrilink_active_role_${userId}`, roles[0]);
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setAvailableRoles([]);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRoles(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRoles]);

  const switchRole = useCallback(async (newRole: 'vendor' | 'affiliate'): Promise<boolean> => {
    if (!user) return false;
    
    if (!availableRoles.includes(newRole)) {
      console.error('User does not have this role');
      return false;
    }

    setUserRole(newRole);
    localStorage.setItem(`afrilink_active_role_${user.id}`, newRole);
    return true;
  }, [user, availableRoles]);

  const addRole = useCallback(async (newRole: 'vendor' | 'affiliate'): Promise<boolean> => {
    if (!user) return false;
    
    if (availableRoles.includes(newRole)) {
      // Already has this role, just switch to it
      return switchRole(newRole);
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: newRole });

      if (error) {
        console.error('Error adding role:', error);
        return false;
      }

      // Refresh roles and switch to new role
      await fetchUserRoles(user.id);
      setUserRole(newRole);
      localStorage.setItem(`afrilink_active_role_${user.id}`, newRole);
      return true;
    } catch (error) {
      console.error('Error adding role:', error);
      return false;
    }
  }, [user, availableRoles, switchRole, fetchUserRoles]);

  const refreshRoles = useCallback(async () => {
    if (user) {
      await fetchUserRoles(user.id);
    }
  }, [user, fetchUserRoles]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setAvailableRoles([]);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      userRole, 
      availableRoles,
      signOut, 
      switchRole,
      addRole,
      refreshRoles
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};