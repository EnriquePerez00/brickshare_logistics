import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let BluetoothManager: any = null;
let BluetoothEscposPrinter: any = null;

try {
  // Solo cargamos la librería nativa si está disponible (evita que Expo Go/Simuladores crasheen)
  const printer = require('react-native-thermal-receipt-printer');
  BluetoothManager = printer.BluetoothManager;
  BluetoothEscposPrinter = printer.BluetoothEscposPrinter;
} catch (e) {
  console.warn('Librería de impresión no disponible (Modo simulador activo)');
}

export default function PrinterSetupScreen() {
  const [devices, setDevices] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);

  useEffect(() => {
    // Cargar impresora guardada previamente
    AsyncStorage.getItem('SAVED_PRINTER_MAC').then(mac => {
      if (mac) {
        setConnectedDevice({ address: mac, name: 'Impresora Guardada' });
      }
    });
  }, []);

  const scanDevices = async () => {
    if (!BluetoothManager) {
      Alert.alert('Modo Simulador', 'La búsqueda Bluetooth no está disponible en este entorno.');
      return;
    }
    
    setScanning(true);
    try {
      const isEnabled = await BluetoothManager.isBluetoothEnabled();
      if (!isEnabled) {
        Alert.alert('Error', 'Por favor, activa el Bluetooth.');
        setScanning(false);
        return;
      }
      
      const res = await BluetoothManager.scanDevices();
      const parsedDevices = JSON.parse(res);
      const found = parsedDevices.found.filter((d: any) => d.name || d.address);
      const paired = parsedDevices.paired.filter((d: any) => d.name || d.address);
      
      setDevices([...paired, ...found]);
    } catch (err: any) {
      Alert.alert('Error escaneando', err.message || 'No se pudo buscar dispositivos.');
    } finally {
      setScanning(false);
    }
  };

  const connectDevice = async (device: any) => {
    setConnecting(true);
    try {
      await BluetoothManager.connect(device.address);
      setConnectedDevice(device);
      // Guardar para futuros usos automáticos tras el drop-off
      await AsyncStorage.setItem('SAVED_PRINTER_MAC', device.address);
      Alert.alert('¡Conectado!', `Conectado a ${device.name || device.address}`);
    } catch (err: any) {
      Alert.alert('Error de Conexión', err.message);
    } finally {
      setConnecting(false);
    }
  };

  const printTest = async () => {
    if (!connectedDevice) return Alert.alert('Error', 'No hay impresora conectada.');
    if (!BluetoothEscposPrinter) return Alert.alert('Modo Simulador', 'La impresión no está disponible.');
    
    try {
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.printText("BRICKSHARE LOGISTICS\n\r", {
        encoding: 'utf8',
        codepage: 0,
        widthtimes: 2,
        heigthtimes: 2,
        fonttype: 1
      });
      await BluetoothEscposPrinter.printText("Impresora conectada correctamente\n\r", {});
      await BluetoothEscposPrinter.printText("--------------------------------\n\r", {});
      await BluetoothEscposPrinter.printQRCode("BRICKSHARE_TEST_QR", 280, BluetoothEscposPrinter.ERROR_CORRECTION.L);
      await BluetoothEscposPrinter.printText("\n\r\n\r", {});
    } catch (err: any) {
      Alert.alert('Error imprimiendo', err.message);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.deviceItem} 
      onPress={() => connectDevice(item)}
      disabled={connecting}
    >
      <Text style={styles.deviceName}>{item.name || 'Dispositivo Desconocido'}</Text>
      <Text style={styles.deviceAddress}>{item.address}</Text>
      {connectedDevice?.address === item.address && (
        <Text style={styles.connectedBadge}>CONECTADO</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuración de Impresora</Text>
      
      {connectedDevice && (
        <View style={styles.connectedCard}>
          <Text style={styles.connectedText}>
            ✓ Emparejado con {connectedDevice.name} ({connectedDevice.address})
          </Text>
          <Button title="Imprimir Ticket de Prueba" onPress={printTest} color="#10b981" />
        </View>
      )}

      <View style={styles.actions}>
        <Button 
          title={scanning ? "Buscando..." : "Buscar Impresoras Bluetooth"} 
          onPress={scanDevices} 
          disabled={scanning || connecting}
        />
      </View>

      {scanning || connecting ? (
        <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item, index) => item.address + index}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No se han buscado dispositivos aún. Pulsa "Buscar".
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', marginBottom: 20 },
  actions: { marginBottom: 20 },
  deviceItem: {
    backgroundColor: '#18181b',
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272a'
  },
  deviceName: { color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' },
  deviceAddress: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  connectedBadge: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 8
  },
  loader: { marginTop: 40 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40 },
  connectedCard: {
    backgroundColor: '#064e3b',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
    marginBottom: 20
  },
  connectedText: { color: '#34d399', fontWeight: 'bold', marginBottom: 10 }
});
