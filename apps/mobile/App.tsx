import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator } from 'react-native';
import { supabase } from '@brickshare/shared';
import { logger } from './src/utils/logger';

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
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Validar configuración de Supabase (DB2 - Remota)
        if (!supabase || !supabase.auth) {
          logger.error('[App] Supabase remote client not initialized', {}, 'App');
          setError('Error inicializando la app. Verifica la configuración de entorno.');
          setLoading(false);
          return;
        }

        logger.info('[App] Initializing authentication with Remote DB (DB2)', {}, 'App');
        
        // Obtener sesión actual desde DB2 (Brickshare remota)
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.error('[App] Session error from remote DB', sessionError, 'App');
          setSession(null);
        } else {
          const isAuthenticated = !!data?.session;
          logger.info(`[App] Session loaded from DB2: ${isAuthenticated ? 'authenticated' : 'not authenticated'}`, 
            { userId: data?.session?.user?.id }, 'App');
          setSession(data?.session);
        }

        // Escuchar cambios de autenticación en DB2
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
          logger.info(`[App] Auth state changed: ${_event}`, { userId: session?.user?.id }, 'App');
          setSession(session);
        });

        setAppReady(true);

        return () => {
          subscription?.unsubscribe();
        };
      } catch (err) {
        logger.error('[App] Error initializing auth', err, 'App');
        setError('Error inicializando autenticación');
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
        <Text style={{ color: '#fafafa', marginTop: 20, fontSize: 14 }}>Inicializando aplicación...</Text>
        <Text style={{ color: '#71717a', marginTop: 8, fontSize: 12 }}>Conectando con DB remota (Brickshare)...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b', paddingHorizontal: 20 }}>
        <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>❌ Error</Text>
        <Text style={{ color: '#fca5a5', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{error}</Text>
        <Text style={{ color: '#71717a', fontSize: 12, marginTop: 20, textAlign: 'center' }}>Verifica tu conexión a internet y la configuración de variables de entorno.</Text>
      </View>
    );
  }

  if (!appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#18181b',
          },
          headerTintColor: '#fafafa',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        {session && session.user ? (
          <>
            <Stack.Screen 
              name="Scanner" 
              component={ScannerScreen} 
              options={{ 
                title: '📦 Escanear Paquetes',
                headerShown: true
              }} 
            />
            <Stack.Screen 
              name="PrinterSetup" 
              component={PrinterSetupScreen} 
              options={{ 
                title: '⚙️ Configurar Impresora' 
              }} 
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
