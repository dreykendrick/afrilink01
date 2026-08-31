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
      // 1. Get the profile id for this auth user
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle();

      const profileId = profile?.id;

      // 2. Query user_roles for this profile_id or userId
      let rolesQuery = supabase
        .from('user_roles')
        .select('roles(name)');

      if (profileId && profileId !== userId) {
        rolesQuery = rolesQuery.or(`profile_id.eq.${profileId},profile_id.eq.${userId}`);
      } else {
        rolesQuery = rolesQuery.eq('profile_id', userId);
      }

      const { data, error } = await rolesQuery;

      if (error && error.code !== 'PGRST116') {
        console.warn('Notice fetching user roles:', error.message);
      }

      // Extract and normalize role names to lowercase ('vendor' | 'affiliate')
      let roles = (data || [])
        .map(r => ((r.roles as any)?.name || (r as any).role || '')?.toLowerCase())
        .filter((r): r is 'vendor' | 'affiliate' => r === 'vendor' || r === 'affiliate');

      // Fallback to user metadata if DB roles not found
      if (roles.length === 0) {
        const { data: userData } = await supabase.auth.getUser();
        const metaRole = (userData?.user?.user_metadata?.role || userData?.user?.user_metadata?.account_type || '')?.toLowerCase();
        if (metaRole === 'vendor' || metaRole === 'affiliate') {
          roles = [metaRole];
        }
      }

      // Default to vendor if still no role resolved
      if (roles.length === 0) {
        roles = ['vendor'];
      }
        
      setAvailableRoles(roles);

      const savedRole = localStorage.getItem(`afrilink_active_role_${userId}`);
      if (savedRole && roles.includes(savedRole as 'vendor' | 'affiliate')) {
        setUserRole(savedRole as 'vendor' | 'affiliate');
      } else if (roles.length > 0) {
        setUserRole(roles[0]);
        localStorage.setItem(`afrilink_active_role_${userId}`, roles[0]);
      }
    } catch (error) {
      console.error('Error resolving user roles:', error);
      setUserRole('vendor');
      setAvailableRoles(['vendor']);
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

    setUserRole(newRole);
    setAvailableRoles(prev => Array.from(new Set([...prev, newRole])));
    localStorage.setItem(`afrilink_active_role_${user.id}`, newRole);
    return true;
  }, [user]);

  const addRole = useCallback(async (newRole: 'vendor' | 'affiliate'): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // 1. Get profile id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const profileId = profile?.id;

      // 2. Find role id matching UPPERCASE or lowercase role
      const uppercaseRole = newRole.toUpperCase();
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .or(`name.eq.${uppercaseRole},name.eq.${newRole}`)
        .maybeSingle();

      if (roleData && profileId) {
        // Insert into user_roles
        const { error } = await supabase
          .from('user_roles')
          .insert({ profile_id: profileId, role_id: roleData.id });

        if (error && error.code !== '23505') {
          console.warn('Notice adding user_role:', error.message);
        }
      }

      // Update state and active role
      setUserRole(newRole);
      setAvailableRoles(prev => Array.from(new Set([...prev, newRole])));
      localStorage.setItem(`afrilink_active_role_${user.id}`, newRole);
      return true;
    } catch (error) {
      console.error('Error adding role:', error);
      setUserRole(newRole);
      setAvailableRoles(prev => Array.from(new Set([...prev, newRole])));
      localStorage.setItem(`afrilink_active_role_${user.id}`, newRole);
      return true;
    }
  }, [user]);

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