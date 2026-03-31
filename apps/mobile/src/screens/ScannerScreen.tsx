import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@brickshare/shared';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { jwtDecode } from 'jwt-decode';

import { useQRDecoder } from '../utils/qrDecoder';
import { logger } from '../utils/logger';
import { useGPSValidation } from '../hooks/useGPSValidation';
import { pudoService } from '../services/pudoService';

// Componentes extraídos
import { DevSimulationModal } from '../components/DevSimulationModal';
import { DevImageUploadModal } from '../components/DevImageUploadModal';

type ScanMode = 'dropoff' | 'pickup';

const __DEV_SIMULATE_SCAN__ = __DEV__;

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('dropoff');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  
  // GPS Hook (Recomendación 1: GPS siempre caliente)
  const { currentLocation, getValidatedLocation, permissionGranted: gpsPermissionGranted } = useGPSValidation();

  const [lastResult, setLastResult] = useState<any>(null);

  // Modales DEV
  const [showSimModal, setShowSimModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [imageCodeInput, setImageCodeInput] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeStatus, setDecodeStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const { decodeQR, QRDecoderView } = useQRDecoder();

  // Logs panel logic
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (showLogs) {
      const interval = setInterval(() => {
        setLogs([...logger.getLogs()].reverse());
      }, 500);
      return () => clearInterval(interval);
    }
  }, [showLogs]);

  useEffect(() => {
    const initialize = async () => {
      logger.debug('ScannerScreen initializing...', {}, 'ScannerScreen');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('No authenticated user found');
        return;
      }
      
      const { data, error } = await supabase
        .from('locations')
        .select('id')
        .eq('owner_id', user.id)
        .single() as any;
        
      if (data?.id) {
        setLocationId(data.id);
        logger.success('Location found', { locationId: data.id }, 'ScannerScreen');
      }
      if (error && error.code !== 'PGRST116') {
        logger.warn('Error fetching location', error, 'ScannerScreen');
      }
    };
    initialize();
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
    setLastResult(null);

    try {
      // Obtener GPS inmediatamente del hook (Recomendación 1)
      const gpsData = await getValidatedLocation();

      if (mode === 'dropoff') {
        const result = await pudoService.processDropoff(data, gpsData);
        setLastResult(result);
        showDropoffSuccess(result, data);
      } else {
        // Recomendación 5: jwt-decode robusto
        let shipmentId = null;
        try {
          const decoded: any = jwtDecode(data);
          shipmentId = decoded.external_shipment_id || decoded.shipment_id;
        } catch (err) {
          logger.error('JWT Decode failed', err, 'handleBarCodeScanned');
          throw new Error('Código QR inválido o mal formado');
        }

        if (!shipmentId) throw new Error('No se pudo extraer el ID del envío del QR');

        const result = await pudoService.processPickup(data, shipmentId, gpsData);
        showPickupSuccess(result);
      }
    } catch (err: any) {
      logger.error('Scan processing failed', err, 'handleBarCodeScanned');
      Alert.alert('Error', err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const showDropoffSuccess = (data: any, trackingCode: string) => {
    const locationName = data.package?.location?.name || 'PUDO';
    const pudoId = data.package?.location?.pudo_id || '';
    const remoteSync = data.remote_sync;
    const shipmentData = data.shipment_data;

    let message = `📦 Paquete registrado en ${locationName}`;
    if (pudoId) message += ` (${pudoId})`;
    message += `\n\n🔖 Tracking: ${trackingCode}`;
    
    if (shipmentData?.customer_name) {
      message += `\n👤 Cliente: ${shipmentData.customer_name}`;
    }

    message += '\n\n── Sincronización Remota ──';
    if (remoteSync?.api_updated) {
      message += `\n✅ Estado remoto actualizado: ${remoteSync.previous_status} → delivered_pudo`;
    } else {
      message += `\n⚠️ Sincronización fallida o parcial: ${remoteSync?.message || 'Revisa logs'}`;
    }

    if (data.gps_validation && !data.gps_validation.passed) {
      message += `\n\n📍 GPS: ${data.gps_validation.message}`;
    }

    Alert.alert('Recepcionado ✅', message, [{ text: 'OK', onPress: () => setScanned(false) }]);
  };

  const showPickupSuccess = (data: any) => {
    const actionText = data.action_type === 'delivery_confirmation' ? 'Entrega confirmada' : 'Devolución recibida';
    Alert.alert(
      '✅ ' + actionText,
      `Estado actualizado: ${data.previous_status} → ${data.new_status}\n\n` +
      `Punto PUDO: ${data.pudo_location.name}\n` +
      `GPS: ${data.gps_validation.message}`,
      [{ text: 'Siguiente', onPress: () => setScanned(false) }]
    );
  };

  const pickImageFromDownloads = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) {
        const uri = result.assets[0].uri;
        setPickedImageUri(uri);
        setImageCodeInput('');
        setDecodeStatus('idle');
        setDecoding(true);
        setShowImageModal(true);

        try {
          const decoded = await decodeQR(uri);
          if (decoded.success && decoded.data) {
            setImageCodeInput(decoded.data);
            setDecodeStatus('success');
          } else {
            setDecodeStatus('failed');
          }
        } catch (err) {
          setDecodeStatus('failed');
        } finally {
          setDecoding(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo abrir el explorador de archivos');
    }
  };

  return (
    <View style={styles.container}>
      {/* Botonera superior */}
      <View style={styles.modeSelector}>
        <TouchableOpacity 
          style={[styles.modeButton, mode === 'dropoff' && styles.modeActive]}
          onPress={() => { setMode('dropoff'); setScanned(false); setLastResult(null); }}
        >
          <Text style={[styles.modeText, mode === 'dropoff' && styles.modeTextActive]}>📦 Recepción</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modeButton, mode === 'pickup' && styles.modeActivePickup]}
          onPress={() => { setMode('pickup'); setScanned(false); setLastResult(null); }}
        >
          <Text style={[styles.modeText, mode === 'pickup' && styles.modeTextActive]}>🤝 Entrega (QR)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={{color: 'white', marginTop: 10, fontSize: 16}}>Procesando...</Text>
          </View>
        ) : (
          // Recomendación 4: CameraView solo si está activa (isFocused)
          isFocused ? (
            <CameraView 
              style={styles.camera} 
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: mode === 'dropoff' 
                  ? ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "qr"]
                  : ["qr"]
              }}
            >
              <View style={styles.overlay}>
                <View style={[styles.scanTarget, mode === 'pickup' && styles.scanTargetQR]} />
                <Text style={styles.scanHint}>
                  {mode === 'dropoff' ? '📦 Escanea el código de barras' : '🔐 Escanea el QR del cliente'}
                </Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.loadingOverlay}>
              <Text style={{color: 'white'}}>Cámara en pausa</Text>
            </View>
          )
        )}
      </View>

      <ScrollView style={styles.footer} contentContainerStyle={styles.footerContent}>
        {/* Indicador GPS */}
        <View style={styles.gpsIndicator}>
          <Text style={styles.gpsText}>
            📍 GPS: {currentLocation 
              ? `${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)} (±${currentLocation.coords.accuracy?.toFixed(0)}m)`
              : 'Obteniendo ubicación...'}
          </Text>
        </View>

        {/* Último resultado */}
        {lastResult && mode === 'dropoff' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>✅ Último paquete registrado</Text>
            <Text style={styles.resultText}>🔖 {lastResult.package?.tracking_code}</Text>
            <Text style={styles.resultTextSmall}>
              📍 {lastResult.package?.location?.name}
            </Text>
          </View>
        )}
        
        <TouchableOpacity style={styles.printSettingsButton} onPress={() => navigation.navigate('PrinterSetup')}>
          <Text style={styles.printSettingsText}>⚙️ Configurar Impresora</Text>
        </TouchableOpacity>

        {/* Botones DEV */}
        {__DEV_SIMULATE_SCAN__ && (
          <View style={styles.devButtonsRow}>
            <TouchableOpacity style={styles.simulateButton} onPress={() => setShowSimModal(true)}>
              <Text style={styles.simulateButtonText}>⌨️ Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadImageButton} onPress={pickImageFromDownloads}>
              <Text style={styles.uploadImageButtonText}>📂 Imagen</Text>
            </TouchableOpacity>
          </View>
        )}

        {scanned && !loading && (
          <Button title={'Escanear de nuevo'} onPress={() => { setScanned(false); setLastResult(null); }} />
        )}
        <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Componentes DEV extraídos */}
      {__DEV_SIMULATE_SCAN__ && (
        <>
          <QRDecoderView />
          <DevSimulationModal 
            visible={showSimModal} 
            onClose={() => setShowSimModal(false)} 
            mode={mode} 
            onProcess={(data) => handleBarCodeScanned({ type: 'manual', data })}
          />
          <DevImageUploadModal 
            visible={showImageModal}
            onClose={() => setShowImageModal(false)}
            mode={mode}
            pickedImageUri={pickedImageUri}
            decoding={decoding}
            decodeStatus={decodeStatus}
            imageCodeInput={imageCodeInput}
            setImageCodeInput={setImageCodeInput}
            setDecodeStatus={setDecodeStatus}
            onProcess={(data) => handleBarCodeScanned({ type: 'image', data })}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  textMessage: { color: 'white', textAlign: 'center', marginBottom: 20 },
  modeSelector: { flexDirection: 'row', padding: 16, gap: 12 },
  modeButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#27272a', alignItems: 'center' },
  modeActive: { backgroundColor: '#3b82f6' },
  modeActivePickup: { backgroundColor: '#10b981' },
  modeText: { color: '#a1a1aa', fontWeight: 'bold' },
  modeTextActive: { color: '#ffffff' },
  cameraContainer: { flex: 1, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  scanTarget: { width: 280, height: 120, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 12 },
  scanTargetQR: { width: 200, height: 200, borderColor: '#10b981' },
  scanHint: { color: '#ffffff', fontSize: 14, marginTop: 16, textAlign: 'center', paddingHorizontal: 20 },
  loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#18181b' },
  footer: { maxHeight: 280, backgroundColor: '#09090b' },
  footerContent: { padding: 20, alignItems: 'center' },
  gpsIndicator: { backgroundColor: '#18181b', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#27272a', width: '100%' },
  gpsText: { color: '#10b981', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  resultCard: { backgroundColor: '#1a2e1a', borderWidth: 1, borderColor: '#22c55e', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%' },
  resultTitle: { color: '#22c55e', fontWeight: 'bold', fontSize: 15, marginBottom: 6 },
  resultText: { color: '#e4e4e7', fontSize: 14, marginBottom: 3 },
  resultTextSmall: { color: '#a1a1aa', fontSize: 12, marginTop: 4 },
  printSettingsButton: { backgroundColor: '#27272a', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginBottom: 12 },
  printSettingsText: { color: '#e4e4e7', fontWeight: '600' },
  devButtonsRow: { flexDirection: 'row', gap: 10, marginBottom: 12, width: '100%' },
  simulateButton: { flex: 1, backgroundColor: '#7c3aed', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  simulateButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  uploadImageButton: { flex: 1, backgroundColor: '#0369a1', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  uploadImageButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  logoutButton: { marginTop: 10 },
  logoutText: { color: '#ef4444' },
});
