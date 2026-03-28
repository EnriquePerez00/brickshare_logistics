import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator } from 'react-native';
import { supabase } from '@brickshare/shared';

import LoginScreen from './src/screens/LoginScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import PrinterSetupScreen from './src/screens/PrinterSetupScreen';

export type RootStackParamList = {
  Login: undefined;
  Scanner: undefined;
  PrinterSetup: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (!supabase || !supabase.auth) {
          console.error('[App] Supabase is not initialized correctly');
          setError('Error initializing app. Check your environment configuration.');
          setLoading(false);
          return;
        }

        console.log('[App] Initializing authentication...');
        
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[App] Session error:', sessionError);
          setSession(null);
        } else {
          console.log('[App] Session loaded:', data?.session ? 'authenticated' : 'not authenticated');
          setSession(data?.session);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
          console.log('[App] Auth state changed:', _event);
          setSession(session);
        });

        return () => {
          subscription?.unsubscribe();
        };
      } catch (err) {
        console.error('[App] Error initializing auth:', err);
        setError('Error initializing authentication');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: '#fafafa', marginTop: 20 }}>Cargando...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' }}>
        <Text style={{ color: '#ef4444', fontSize: 16 }}>{error}</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {session && session.user ? (
          <>
            <Stack.Screen 
              name="Scanner" 
              component={ScannerScreen} 
              options={{ title: 'Escanear Paquetes' }} 
            />
            <Stack.Screen 
              name="PrinterSetup" 
              component={PrinterSetupScreen} 
              options={{ title: 'Configurar Impresora' }} 
            />
          </>
        ) : (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
