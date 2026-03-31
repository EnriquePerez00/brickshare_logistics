import { useEffect, useState } from 'react';
import { supabase } from '@brickshare/shared';
import { logger } from '../utils/logger';

/**
 * Hook para gestionar contexto de autenticación con Dual Database
 * 
 * Características:
 * - Sincroniza estado de autenticación con DB2 (Brickshare remota)
 * - Maneja JWT y tokens de sesión
 * - Proporciona métodos para login/logout
 * - Realiza validación de sesión
 * 
 * Uso:
 *   const { session, user, loading, error, signOut } = useAuthContext();
 */

export interface AuthContextType {
  session: any | null;
  user: any | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export function useAuthContext(): AuthContextType {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        logger.info('🔐 [useAuthContext] Initializing auth context', {}, 'useAuthContext');

        // Obtener sesión actual de DB2
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          logger.error('❌ [useAuthContext] Error fetching session', sessionError, 'useAuthContext');
          setError(sessionError.message);
          setSession(null);
          setUser(null);
        } else {
          logger.info('✅ [useAuthContext] Session fetched', 
            { authenticated: !!session }, 'useAuthContext');
          setSession(session);
          setUser(session?.user ?? null);
          setError(null);
        }

        // Escuchar cambios de autenticación en tiempo real
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event: string, newSession: any) => {
            logger.info(`🔄 [useAuthContext] Auth state changed: ${event}`, 
              { authenticated: !!newSession }, 'useAuthContext');
            setSession(newSession);
            setUser(newSession?.user ?? null);
          }
        );

        return () => {
          subscription?.unsubscribe();
        };
      } catch (err: any) {
        logger.error('❌ [useAuthContext] Initialization error', err, 'useAuthContext');
        setError(err?.message || 'Error initializing auth');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Cierra la sesión del usuario en DB2
   */
  const signOut = async () => {
    try {
      logger.info('🚪 [useAuthContext] Signing out', {}, 'useAuthContext');

      const { error } = await supabase.auth.signOut();

      if (error) {
        logger.error('❌ [useAuthContext] Signout error', error, 'useAuthContext');
        throw error;
      }

      setSession(null);
      setUser(null);
      logger.success('✅ [useAuthContext] Signed out successfully', {}, 'useAuthContext');
    } catch (err: any) {
      logger.error('❌ [useAuthContext] Signout failed', err, 'useAuthContext');
      throw err;
    }
  };

  /**
   * Refresca la sesión actual
   */
  const refreshSession = async () => {
    try {
      logger.debug('🔄 [useAuthContext] Refreshing session', {}, 'useAuthContext');

      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error('❌ [useAuthContext] Refresh error', error, 'useAuthContext');
        throw error;
      }

      setSession(session);
      setUser(session?.user ?? null);
      logger.success('✅ [useAuthContext] Session refreshed', {}, 'useAuthContext');
    } catch (err: any) {
      logger.error('❌ [useAuthContext] Refresh failed', err, 'useAuthContext');
      throw err;
    }
  };

  return {
    session,
    user,
    loading,
    error,
    signOut,
    refreshSession,
  };
}