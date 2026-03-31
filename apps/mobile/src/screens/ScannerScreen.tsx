import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@brickshare/shared';
import { useNavigation, useIsFocused } from '@react-navigation/native';

import { useQRDecoder } from '../utils/qrDecoder';
import { logger } from '../utils/logger';
import { useGPSValidation } from '../hooks/useGPSValidation';
import { pudoService, ScanResult } from '../services/pudoService';

// Componentes extraídos
import { DevSimulationModal } from '../components/DevSimulationModal';
import { DevImageUploadModal } from '../components/DevImageUploadModal';

const __DEV_SIMULATE_SCAN__ = __DEV__;

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [, setLocationId] = useState<string | null>(null);
  
  // GPS Hook (GPS siempre caliente)
  const { currentLocation, getValidatedLocation } = useGPSValidation();

  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  // Modales DEV
  const [showSimModal, setShowSimModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [imageCodeInput, setImageCodeInput] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeStatus, setDecodeStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const { decodeQR, QRDecoderView } = useQRDecoder();

  useEffect(() => {
    const initialize = async () => {
      logger.debug('ScannerScreen initializing...', {}, 'ScannerScreen');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('No authenticated user found');
        return;
      }
      
      const { data, error } = await supabase
        .from('user_locations')
        .select('location_id')
        .eq('user_id', user.id)
        .single() as any;
        
      if (data?.location_id) {
        setLocationId(data.location_id);
        logger.success('Location found', { locationId: data.location_id }, 'ScannerScreen');
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

  /**
   * Maneja escaneos QR unificados
   * La Edge Function detecta automáticamente si es DROPOFF o PICKUP
   */
  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    setScanned(true);
    setLoading(true);
    setLastResult(null);

    try {
      // Obtener GPS inmediatamente del hook
      const gpsData = await getValidatedLocation();

      logger.info('🔍 [Scanner] Processing QR scan', { scannedCode: data }, 'ScannerScreen');

      // Llamar función unificada - la Edge Function detecta el tipo
      const result = await pudoService.processScan(data, gpsData);
      
      setLastResult(result);
      
      // Mostrar mensaje según tipo de operación detectada
      if (result.operation_type === 'dropoff') {
        showDropoffSuccess(result, data);
      } else {
        showPickupSuccess(result);
      }
    } catch (err: any) {
      logger.error('Scan processing failed', err, 'handleBarCodeScanned');
      Alert.alert('Error', err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Muestra mensaje de éxito para DROPOFF (recepción en PUDO)
   */
  const showDropoffSuccess = (result: ScanResult, trackingCode: string) => {
    const locationName = result.package?.location?.name || 'PUDO';
    const pudoId = result.package?.location?.pudo_id || '';

    let message = `📦 Paquete registrado en ${locationName}`;
    if (pudoId) message += ` (${pudoId})`;
    message += `\n\n🔖 Tracking: ${trackingCode}`;
    
    if (result.shipment?.customer_id) {
      message += `\n👤 Cliente: ${result.shipment.customer_id}`;
    }

    message += '\n\n── Estado Actualizado ──';
    message += `\n✅ ${result.shipment?.previous_status} → ${result.shipment?.new_status}`;
    message += `\n⏱️ Validado a las ${new Date(result.timestamp).toLocaleTimeString()}`;
    message += `\n⚡ Tiempo de procesamiento: ${result.duration_ms}ms`;

    Alert.alert('✅ Recepción Confirmada', message, [{ text: 'OK', onPress: () => setScanned(false) }]);
  };

  /**
   * Muestra mensaje de éxito para PICKUP (entrega a cliente)
   */
  const showPickupSuccess = (result: ScanResult) => {
    const locationName = result.package?.location?.name || 'PUDO';

    let message = `📦 Paquete entregado al cliente\n\n`;
    message += `Punto PUDO: ${locationName}\n`;
    message += `🔖 Tracking: ${result.package?.tracking_number}\n`;
    message += `\n── Estado Actualizado ──\n`;
    message += `✅ ${result.shipment?.previous_status} → ${result.shipment?.new_status}`;
    message += `\n⏱️ Entregado a las ${new Date(result.timestamp).toLocaleTimeString()}`;
    message += `\n⚡ Tiempo: ${result.duration_ms}ms`;

    Alert.alert('✅ Entrega Confirmada', message, [{ text: 'Siguiente', onPress: () => setScanned(false) }]);
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
      {/* Indicador de modo unificado */}
      <View style={styles.modeIndicator}>
        <Text style={styles.modeIndicatorText}>🔍 Escanea QR o Código de Barras</Text>
      </View>

      <View style={styles.cameraContainer}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={{color: 'white', marginTop: 10, fontSize: 16}}>Procesando...</Text>
          </View>
        ) : (
          isFocused ? (
            <CameraView 
              style={styles.camera} 
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "qr"]
              }}
            >
              <View style={styles.overlay}>
                <View style={styles.scanTarget} />
                <Text style={styles.scanHint}>
                  📦 Escanea el código de barras o QR
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
        {lastResult && (
          <View style={[
            styles.resultCard, 
            lastResult.operation_type === 'pickup' && styles.resultCardPickup
          ]}>
            <Text style={[
              styles.resultTitle,
              lastResult.operation_type === 'pickup' && styles.resultTitlePickup
            ]}>
              {lastResult.operation_type === 'dropoff' 
                ? '✅ Recepción Confirmada' 
                : '✅ Entrega Confirmada'}
            </Text>
            <Text style={styles.resultText}>
              🔖 {lastResult.package?.tracking_number}
            </Text>
            <Text style={styles.resultTextSmall}>
              📍 {lastResult.package?.location?.name}
            </Text>
            <Text style={styles.resultTextSmall}>
              {lastResult.shipment?.previous_status} → {lastResult.shipment?.new_status}
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
            onProcess={(data) => handleBarCodeScanned({ type: 'manual', data })}
          />
          <DevImageUploadModal 
            visible={showImageModal}
            onClose={() => setShowImageModal(false)}
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
  modeIndicator: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#18181b', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  modeIndicatorText: { color: '#e4e4e7', fontWeight: '600', fontSize: 14 },
  cameraContainer: { flex: 1, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  scanTarget: { width: 280, height: 120, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 12 },
  scanHint: { color: '#ffffff', fontSize: 14, marginTop: 16, textAlign: 'center', paddingHorizontal: 20 },
  loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#18181b' },
  footer: { maxHeight: 280, backgroundColor: '#09090b' },
  footerContent: { padding: 20, alignItems: 'center' },
  gpsIndicator: { backgroundColor: '#18181b', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#27272a', width: '100%' },
  gpsText: { color: '#10b981', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  resultCard: { backgroundColor: '#1a2e1a', borderWidth: 1, borderColor: '#22c55e', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%' },
  resultCardPickup: { backgroundColor: '#1a2e3a', borderColor: '#06b6d4' },
  resultTitle: { color: '#22c55e', fontWeight: 'bold', fontSize: 15, marginBottom: 6 },
  resultTitlePickup: { color: '#06b6d4' },
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