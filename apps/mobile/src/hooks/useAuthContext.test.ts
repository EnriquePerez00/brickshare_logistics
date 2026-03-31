import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuthContext, AuthContextType } from './useAuthContext';
import { supabase } from '@brickshare/shared';
import { logger } from '../utils/logger';

jest.mock('@brickshare/shared');
jest.mock('../utils/logger');

describe('useAuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with loading state true', () => {
      const mockSession = { user: { id: '123', email: 'test@example.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const { result } = renderHook(() => useAuthContext());

      expect(result.current.loading).toBe(true);
    });

    it('should fetch session on mount', async () => {
      const mockSession = { user: { id: '123', email: 'test@example.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockSession.user);
    });

    it('should set user from session', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { user: mockUser };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
    });

    it('should handle session fetch error', async () => {
      const mockError = new Error('Session fetch failed');
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: mockError,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should setup auth state listener on mount', async () => {
      const mockUnsubscribe = jest.fn();
      const mockSubscription = { unsubscribe: mockUnsubscribe };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });

      const { unmount } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
      });

      unmount();

      // Verify subscription cleanup
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      const mockSession = { user: { id: '123', email: 'test@example.com' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(logger.success).toHaveBeenCalled();
    });

    it('should handle signOut error', async () => {
      const mockSession = { user: { id: '123' } };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const mockError = new Error('SignOut failed');
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: mockError,
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.signOut();
        } catch (err) {
          // Expected to throw
        }
      });

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log signOut attempt', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Signing out'),
        {},
        'useAuthContext'
      );
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      const initialSession = { user: { id: '123' } };
      const refreshedSession = { user: { id: '123', updated_at: new Date() } };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: initialSession },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: refreshedSession },
        error: null,
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(supabase.auth.refreshSession).toHaveBeenCalled();
      expect(result.current.session).toEqual(refreshedSession);
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Session refreshed'),
        {},
        'useAuthContext'
      );
    });

    it('should handle refresh session error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const mockError = new Error('Refresh failed');
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: mockError,
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.refreshSession();
        } catch (err) {
          // Expected to throw
        }
      });

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log refresh debug info', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Refreshing session'),
        {},
        'useAuthContext'
      );
    });
  });

  describe('Auth state changes', () => {
    it('should update state when auth state changes', async () => {
      let authStateCallback: ((event: string, session: any) => void) | null = null;

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateCallback = callback;
        return {
          data: { subscription: { unsubscribe: jest.fn() } },
        };
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newSession = { user: { id: '456', email: 'newuser@example.com' } };

      act(() => {
        if (authStateCallback) {
          authStateCallback('SIGNED_IN', newSession);
        }
      });

      await waitFor(() => {
        expect(result.current.session).toEqual(newSession);
        expect(result.current.user).toEqual(newSession.user);
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Auth state changed'),
        expect.any(Object),
        'useAuthContext'
      );
    });
  });

  describe('Interface compliance', () => {
    it('should return AuthContextType with all required properties', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const { result } = renderHook(() => useAuthContext());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const context: AuthContextType = result.current;

      expect(context).toHaveProperty('session');
      expect(context).toHaveProperty('user');
      expect(context).toHaveProperty('loading');
      expect(context).toHaveProperty('error');
      expect(context).toHaveProperty('signOut');
      expect(context).toHaveProperty('refreshSession');
      expect(typeof context.signOut).toBe('function');
      expect(typeof context.refreshSession).toBe('function');
    });
  });
});