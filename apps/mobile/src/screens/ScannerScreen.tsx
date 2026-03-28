import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, TouchableOpacity, Platform, TextInput, Modal, KeyboardAvoidingView, ScrollView, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@brickshare/shared';
import { useNavigation } from '@react-navigation/native';
import { useQRDecoder } from '../utils/qrDecoder';

type ScanMode = 'dropoff' | 'pickup';

// ── DEV/EMULATOR: habilitar simulación manual de scan ──
const __DEV_SIMULATE_SCAN__ = __DEV__;

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('dropoff');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [gpsPermission, requestGpsPermission] = Location.useForegroundPermissions();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  // ── Resultado del último scan ──
  const [lastResult, setLastResult] = useState<any>(null);
  // ── Simulación de scan (solo en DEV) ──
  const [showSimModal, setShowSimModal] = useState(false);
  const [simInput, setSimInput] = useState('');
  const simInputRef = useRef<TextInput>(null);
  // ── Upload de imagen (solo en DEV) ──
  const [showImageModal, setShowImageModal] = useState(false);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [imageCodeInput, setImageCodeInput] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeStatus, setDecodeStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  // QR Decoder hook
  const { decodeQR, QRDecoderView } = useQRDecoder();

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('locations')
        .select('id')
        .eq('owner_id', user.id)
        .single() as any;
        
      if (data?.id) setLocationId(data.id);
      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching location:', error);
      }

      if (!gpsPermission?.granted) {
        await requestGpsPermission();
      }

      if (gpsPermission?.granted) {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setCurrentLocation(loc);
        } catch (err) {
          console.warn('Error getting GPS location:', err);
        }
      }
    };
    initialize();
  }, [gpsPermission]);

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

  // ═══════════════════════════════════════════════════════════
  // DROPOFF: Escaneo de código de barras → Alta completa
  // Llama a Edge Function process-pudo-scan que:
  //   1. Consulta API remota con el tracking code
  //   2. Obtiene toda la info del shipment
  //   3. Crea el package en BD local
  //   4. Registra en pudo_scan_logs
  //   5. Actualiza shipment.shipping_status → "delivered_pudo"
  // ═══════════════════════════════════════════════════════════
  const handleDropoff = async (trackingCode: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No hay sesión activa');

    // Obtener ubicación GPS actualizada
    let gpsData = null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
      });
      gpsData = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0,
      };
      setCurrentLocation(loc);
    } catch (err) {
      console.warn('Could not get GPS location:', err);
    }

    console.log(`[ScannerScreen] Processing dropoff for: ${trackingCode}`);

    // Llamada a Edge Function process-pudo-scan
    const { data, error } = await supabase.functions.invoke('process-pudo-scan', {
      body: {
        scanned_code: trackingCode,
        scan_mode: 'dropoff',
        gps_latitude: gpsData?.latitude,
        gps_longitude: gpsData?.longitude,
        gps_accuracy: gpsData?.accuracy,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      throw new Error(error.message || 'Error procesando el escaneo');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    // Guardar resultado para mostrar detalles
    setLastResult(data);

    // Construir mensaje de confirmación
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
    if (shipmentData?.delivery_address) {
      message += `\n📍 Dirección: ${shipmentData.delivery_address}`;
    }

    message += '\n\n── Sincronización Remota ──';
    if (remoteSync?.api_updated) {
      message += `\n✅ Estado remoto actualizado: ${remoteSync.previous_status} → delivered_pudo`;
    } else if (remoteSync?.shipment_found) {
      message += `\n⚠️ Shipment encontrado pero no se pudo actualizar`;
      message += `\n   ${remoteSync.message}`;
    } else {
      message += `\n⚠️ Shipment no encontrado en BD remota`;
      message += `\n   Paquete registrado solo localmente`;
    }

    if (data.gps_validation && !data.gps_validation.passed) {
      message += `\n\n📍 GPS: ${data.gps_validation.message}`;
    }

    message += `\n\n⏱️ Procesado en ${data.duration_ms}ms`;

    Alert.alert(
      'Recepcionado ✅', 
      message,
      [{ text: 'OK', onPress: () => setScanned(false) }]
    );
  };

  // ═══════════════════════════════════════════════════════════
  // PICKUP: Escaneo de QR dinámico → Confirmar entrega al cliente
  // ═══════════════════════════════════════════════════════════
  const handlePickup = async (qrHash: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No hay sesión activa');

    // Obtener ubicación GPS actualizada
    let gpsData = null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
      });
      gpsData = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0,
      };
      setCurrentLocation(loc);
    } catch (err) {
      console.warn('Could not get GPS location:', err);
    }

    // Extraer shipment_id del QR (asumiendo que está en el payload JWT)
    let shipmentId = null;
    try {
      const payloadBase64 = qrHash.split('.')[1];
      if (payloadBase64) {
        const payload = JSON.parse(atob(payloadBase64));
        shipmentId = payload.external_shipment_id || payload.shipment_id;
      }
    } catch (err) {
      console.warn('Could not extract shipment_id from QR:', err);
    }

    if (!shipmentId) {
      throw new Error('No se pudo extraer shipment_id del código QR');
    }

    // Llamada a Edge Function para actualizar estado remoto (entrega al cliente)
    const { data, error } = await supabase.functions.invoke('update-remote-shipment-status', {
      body: {
        shipment_id: shipmentId,
        qr_data: qrHash,
        gps_latitude: gpsData?.latitude,
        gps_longitude: gpsData?.longitude,
        gps_accuracy: gpsData?.accuracy,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
       throw new Error(error.message || 'Error en la operación de entrega');
    }

    const actionText = data.action_type === 'delivery_confirmation' 
      ? 'Entrega confirmada' 
      : 'Devolución recibida';

    Alert.alert(
      '✅ ' + actionText,
      `Estado actualizado: ${data.previous_status} → ${data.new_status}\n\n` +
      `Punto PUDO: ${data.pudo_location.name}\n` +
      `GPS: ${data.gps_validation.message}`,
      [{ text: 'Siguiente', onPress: () => setScanned(false) }]
    );
  };

  // ═══════════════════════════════════════════════════════════
  // DEV: Seleccionar imagen desde /sdcard/Download (Android)
  // Flujo: Explorador archivos → Auto-decode QR → Manual para barcodes
  // Arrastra imágenes desde macOS al emulador → aparecen en /sdcard/Download
  // ═══════════════════════════════════════════════════════════
  const pickImageFromDownloads = async () => {
    try {
      // Usa DocumentPicker para navegar al sistema de archivos (abre en Download por defecto en Android)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const uri = result.assets[0].uri;
        setPickedImageUri(uri);
        setImageCodeInput('');
        setDecodeStatus('idle');
        setDecoding(true);
        setShowImageModal(true);

        // Intentar decodificar QR automáticamente
        try {
          const decoded = await decodeQR(uri);
          if (decoded.success && decoded.data) {
            setImageCodeInput(decoded.data);
            setDecodeStatus('success');
          } else {
            setDecodeStatus('failed');
          }
        } catch (err) {
          console.warn('QR decode error:', err);
          setDecodeStatus('failed');
        } finally {
          setDecoding(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo abrir el explorador de archivos: ' + (err.message || 'Error desconocido'));
    }
  };

  return (
    <View style={styles.container}>
      {/* Botonera superior para cambiar modo */}
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
            <Text style={{color: 'white', marginTop: 10, fontSize: 16}}>
              {mode === 'dropoff' 
                ? 'Consultando API remota y registrando paquete...' 
                : 'Procesando...'}
            </Text>
          </View>
        ) : (
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
                {mode === 'dropoff' 
                  ? '📦 Escanea el código de barras de la etiqueta' 
                  : '🔐 Escanea el QR dinámico del cliente'}
              </Text>
            </View>
          </CameraView>
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

        {/* Último resultado (si existe) */}
        {lastResult && mode === 'dropoff' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>✅ Último paquete registrado</Text>
            <Text style={styles.resultText}>🔖 {lastResult.package?.tracking_code}</Text>
            {lastResult.shipment_data?.customer_name && (
              <Text style={styles.resultText}>👤 {lastResult.shipment_data.customer_name}</Text>
            )}
            <Text style={styles.resultText}>
              🔄 Remoto: {lastResult.remote_sync?.api_updated ? '✅ Actualizado' : '⚠️ Sin sincronizar'}
            </Text>
            <Text style={styles.resultTextSmall}>
              📍 {lastResult.package?.location?.pudo_id} — {lastResult.package?.location?.name}
            </Text>
          </View>
        )}
        
        <Text style={styles.instructions}>
          {mode === 'dropoff' 
            ? 'Escanea el código de barras de la etiqueta del operador.\nEl sistema consultará la info del envío y lo registrará automáticamente.'
            : 'Apunta al código QR dinámico en la pantalla del cliente.\n⚠️ Validación GPS requerida para confirmar la operación.'}
        </Text>
        
        <TouchableOpacity style={styles.printSettingsButton} onPress={() => navigation.navigate('PrinterSetup')}>
          <Text style={styles.printSettingsText}>⚙️ Configurar Impresora</Text>
        </TouchableOpacity>

        {/* ── Botones DEV: Simular scan y Upload de imagen (solo DEV/Emulador) ── */}
        {__DEV_SIMULATE_SCAN__ && (
          <View style={styles.devButtonsRow}>
            <TouchableOpacity 
              style={styles.simulateButton} 
              onPress={() => { setShowSimModal(true); setSimInput(''); }}
            >
              <Text style={styles.simulateButtonText}>⌨️ Código Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.uploadImageButton} 
              onPress={pickImageFromDownloads}
            >
              <Text style={styles.uploadImageButtonText}>📂 Desde Download</Text>
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

      {/* ── Hidden QR Decoder WebView (solo DEV) ── */}
      {__DEV_SIMULATE_SCAN__ && <QRDecoderView />}

      {/* ── Modal para upload de imagen (solo DEV) ── */}
      {__DEV_SIMULATE_SCAN__ && (
        <Modal visible={showImageModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.imageModalContent}>
              <Text style={styles.modalTitle}>
                🖼️ {mode === 'dropoff' ? 'Imagen de Código de Barras' : 'Imagen de QR'}
              </Text>

              {/* Vista previa de la imagen */}
              {pickedImageUri && (
                <View style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: pickedImageUri }} 
                    style={styles.imagePreview} 
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* Estado de decodificación */}
              {decoding && (
                <View style={styles.decodeStatusBar}>
                  <ActivityIndicator size="small" color="#60a5fa" />
                  <Text style={styles.decodeStatusText}>🔍 Decodificando QR...</Text>
                </View>
              )}
              {!decoding && decodeStatus === 'success' && (
                <View style={[styles.decodeStatusBar, styles.decodeSuccess]}>
                  <Text style={styles.decodeSuccessText}>✅ QR decodificado automáticamente</Text>
                </View>
              )}
              {!decoding && decodeStatus === 'failed' && (
                <View style={[styles.decodeStatusBar, styles.decodeFailed]}>
                  <Text style={styles.decodeFailedText}>
                    ⚠️ No se detectó QR. {mode === 'dropoff' ? 'Introduce el código de barras manualmente:' : 'Introduce el contenido del QR manualmente:'}
                  </Text>
                </View>
              )}

              <TextInput
                style={[
                  styles.imageModalInput, 
                  decodeStatus === 'success' && styles.imageModalInputSuccess
                ]}
                value={imageCodeInput}
                onChangeText={(text) => {
                  setImageCodeInput(text);
                  if (decodeStatus === 'success') setDecodeStatus('idle');
                }}
                placeholder={mode === 'dropoff' ? 'Tracking code (ej: BS-DEL-7A2D335C)...' : 'Contenido del QR...'}
                placeholderTextColor="#71717a"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!decoding}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn} 
                  onPress={() => { setShowImageModal(false); setPickedImageUri(null); setDecodeStatus('idle'); }}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalScanBtn, (!imageCodeInput.trim() || decoding) && { opacity: 0.5 }]} 
                  disabled={!imageCodeInput.trim() || decoding}
                  onPress={() => {
                    setShowImageModal(false);
                    setPickedImageUri(null);
                    setDecodeStatus('idle');
                    const barcodeType = mode === 'dropoff' ? 'code128' : 'qr';
                    handleBarCodeScanned({ type: barcodeType, data: imageCodeInput.trim() });
                  }}
                >
                  <Text style={styles.modalScanText}>🚀 Procesar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ── Modal para simular scan manualmente ── */}
      {__DEV_SIMULATE_SCAN__ && (
        <Modal visible={showSimModal} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {mode === 'dropoff' ? '📦 Simular Código de Barras' : '🔐 Simular QR de Entrega'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {mode === 'dropoff' 
                  ? 'Pega aquí el tracking code (ej: BS-DEL-7A2D335C-8FA).\nEl sistema consultará la API remota automáticamente.'
                  : 'Pega aquí el contenido del QR (JWT token):'}
              </Text>
              <TextInput
                ref={simInputRef}
                style={styles.modalInput}
                value={simInput}
                onChangeText={setSimInput}
                placeholder={mode === 'dropoff' ? 'ej: BS-DEL-7A2D335C-8FA' : 'ej: eyJhbGciOiJIUzI1NiIs...'}
                placeholderTextColor="#71717a"
                multiline
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn} 
                  onPress={() => setShowSimModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalScanBtn, !simInput.trim() && { opacity: 0.5 }]} 
                  disabled={!simInput.trim()}
                  onPress={() => {
                    setShowSimModal(false);
                    const barcodeType = mode === 'dropoff' ? 'code128' : 'qr';
                    handleBarCodeScanned({ type: barcodeType, data: simInput.trim() });
                  }}
                >
                  <Text style={styles.modalScanText}>🚀 Procesar Scan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
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
    width: 280,
    height: 120,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  scanTargetQR: {
    width: 200,
    height: 200,
    borderColor: '#10b981',
  },
  scanHint: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b',
  },
  footer: {
    maxHeight: 320,
    backgroundColor: '#09090b',
  },
  footerContent: {
    padding: 20,
    alignItems: 'center',
  },
  instructions: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
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
    marginBottom: 12
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
  },
  // ── Resultado del último scan ──
  resultCard: {
    backgroundColor: '#1a2e1a',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    width: '100%',
  },
  resultTitle: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 6,
  },
  resultText: {
    color: '#e4e4e7',
    fontSize: 14,
    marginBottom: 3,
  },
  resultTextSmall: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 4,
  },
  // ── GPS indicator ──
  gpsIndicator: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    width: '100%',
  },
  gpsText: {
    color: '#10b981',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  // ── DEV buttons row ──
  devButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    width: '100%',
  },
  simulateButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8b5cf6',
    alignItems: 'center',
  },
  simulateButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  uploadImageButton: {
    flex: 1,
    backgroundColor: '#0369a1',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
    alignItems: 'center',
  },
  uploadImageButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    color: '#fafafa',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#27272a',
    color: '#fafafa',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#3f3f46',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#27272a',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#a1a1aa',
    fontWeight: '600',
    fontSize: 16,
  },
  modalScanBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  modalScanText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // ── Image modal ──
  imageModalContent: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  imagePreviewContainer: {
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  imagePreview: {
    width: '100%',
    height: 200,
  },
  imageTip: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imageTipText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  imageModalInput: {
    backgroundColor: '#27272a',
    color: '#fafafa',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3f3f46',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  imageModalInputSuccess: {
    borderColor: '#22c55e',
    backgroundColor: '#1a2e1a',
  },
  // ── Decode status bar ──
  decodeStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  decodeStatusText: {
    color: '#60a5fa',
    fontSize: 13,
  },
  decodeSuccess: {
    backgroundColor: '#1a2e1a',
    borderColor: '#22c55e',
  },
  decodeSuccessText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  decodeFailed: {
    backgroundColor: '#2e1a1a',
    borderColor: '#f59e0b',
  },
  decodeFailedText: {
    color: '#f59e0b',
    fontSize: 12,
    lineHeight: 17,
  },
});
