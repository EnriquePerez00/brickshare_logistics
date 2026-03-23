import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '@brickshare/shared';
import { useNavigation } from '@react-navigation/native';

type ScanMode = 'dropoff' | 'pickup';

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('dropoff');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);

  useEffect(() => {
    // Obtener la Location del Owner actual
    const fetchLocation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('locations')
        .select('id')
        .eq('owner_id', user.id)
        .single();
        
      if (data) setLocationId(data.id);
      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching location:', error);
      }
    };
    fetchLocation();
  }, []);

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.textMessage}>Necesitamos permiso para usar la cámara</Text>
        <Button onPress={requestPermission} title="Otorgar permiso" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setLoading(true);

    try {
      if (mode === 'dropoff') {
        await handleDropoff(data);
      } else {
        await handlePickup(data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleDropoff = async (trackingCode: string) => {
    if (!locationId) throw new Error('No se encontró local asignado a tu usuario.');

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('packages')
      .select('id, status')
      .eq('tracking_code', trackingCode)
      .single();

    if (existing) {
      if (existing.status === 'in_location') {
        throw new Error('Este paquete ya está registrado en el local.');
      } else {
        throw new Error(`Paquete existente con estado: ${existing.status}`);
      }
    }

    // Insertar
    const { error } = await supabase.from('packages').insert({
      tracking_code: trackingCode,
      location_id: locationId,
      status: 'in_location'
    });

    if (error) throw error;
    
    Alert.alert(
      'Recepcionado ✅', 
      `El paquete ${trackingCode} ha sido registrado.\n\nImprimiendo recibo...`,
      [{ text: 'OK', onPress: () => setScanned(false) }]
    );
    // TODO: Llamar al servicio de impresión de tickets
  };

  const handlePickup = async (qrHash: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No hay sesión activa');

    // Llamada a Edge Function
    const { data, error } = await supabase.functions.invoke('verify-package-qr', {
      body: { qr_hash: qrHash },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
       // extraemos error de edge function custom response
       const errBody = await error.context?.json?.();
       throw new Error(errBody?.error || error.message);
    }

    Alert.alert(
      'Entregado ✅', 
      `Paquete ${data.tracking_code} recogido correctamente por el cliente.`,
      [{ text: 'Siguiente', onPress: () => setScanned(false) }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Botonera superior para cambiar modo */}
      <View style={styles.modeSelector}>
        <TouchableOpacity 
          style={[styles.modeButton, mode === 'dropoff' && styles.modeActive]}
          onPress={() => { setMode('dropoff'); setScanned(false); }}
        >
          <Text style={[styles.modeText, mode === 'dropoff' && styles.modeTextActive]}>Recepción</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modeButton, mode === 'pickup' && styles.modeActivePickup]}
          onPress={() => { setMode('pickup'); setScanned(false); }}
        >
          <Text style={[styles.modeText, mode === 'pickup' && styles.modeTextActive]}>Entrega (QR)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={{color: 'white', marginTop: 10, fontSize: 16}}>Procesando...</Text>
          </View>
        ) : (
          <CameraView 
            style={styles.camera} 
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: mode === 'dropoff' 
                ? ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e"] // códigos de barras courier
                : ["qr"] // Delivery QR es QrCode
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanTarget} />
            </View>
          </CameraView>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.instructions}>
          {mode === 'dropoff' 
            ? 'Apunta al código de barras de la etiqueta del operador.'
            : 'Apunta al código QR dinámico en la pantalla del cliente.'}
        </Text>
        
        <TouchableOpacity style={styles.printSettingsButton} onPress={() => navigation.navigate('PrinterSetup')}>
          <Text style={styles.printSettingsText}>⚙️ Configurar Impresora</Text>
        </TouchableOpacity>

        {scanned && !loading && (
          <Button title={'Escanear de nuevo'} onPress={() => setScanned(false)} />
        )}
        <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  modeSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#27272a',
    alignItems: 'center'
  },
  modeActive: { backgroundColor: '#3b82f6' },
  modeActivePickup: { backgroundColor: '#10b981' },
  modeText: { color: '#a1a1aa', fontWeight: 'bold' },
  modeTextActive: { color: '#ffffff' },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTarget: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b',
  },
  footer: {
    padding: 24,
    backgroundColor: '#09090b',
    alignItems: 'center'
  },
  instructions: {
    color: '#fafafa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20
  },
  textMessage: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 20
  },
  printSettingsButton: {
    backgroundColor: '#27272a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20
  },
  printSettingsText: {
    color: '#e4e4e7',
    fontWeight: '600'
  },
  logoutButton: {
    marginTop: 10
  },
  logoutText: {
    color: '#ef4444',
  }
});
