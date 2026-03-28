import { Platform, Dimensions } from 'react-native';

/**
 * Configuración específica por plataforma
 * Centraliza todas las diferencias entre iOS y Android
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Constantes de Plataforma ────────────────────────────────────────────────

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';
export const PLATFORM = Platform.OS;

// ─── Configuración de UI ─────────────────────────────────────────────────────

export const platformUI = {
  /** Padding superior para evitar notch/status bar */
  statusBarPadding: IS_IOS ? 44 : 24,

  /** Padding inferior para safe area (home indicator en iOS) */
  bottomSafePadding: IS_IOS ? 34 : 0,

  /** Fuente monospace según plataforma */
  monoFont: IS_IOS ? 'Courier' : 'monospace',

  /** Tamaño de header de navegación */
  headerHeight: IS_IOS ? 44 : 56,

  /** Sombras por plataforma */
  shadow: IS_IOS
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      }
    : {
        elevation: 4,
      },

  /** Sombra fuerte */
  shadowStrong: IS_IOS
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      }
    : {
        elevation: 8,
      },

  /** Dimensiones de pantalla */
  screen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
};

// ─── Configuración de Cámara ─────────────────────────────────────────────────

export const cameraConfig = {
  /** Tipos de código de barras para recepción (drop-off) */
  dropoffBarcodeTypes: IS_IOS
    ? (['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] as const)
    : (['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] as const),

  /** Tipos de código QR para entrega (pickup) */
  pickupBarcodeTypes: ['qr'] as const,

  /** Ratio de escaneo */
  scanAreaSize: {
    width: IS_IOS ? 250 : 280,
    height: IS_IOS ? 150 : 170,
  },
};

// ─── Configuración de Bluetooth/Impresora ────────────────────────────────────

export const bluetoothConfig = {
  /** Timeout de conexión (ms) */
  connectionTimeout: IS_IOS ? 10000 : 15000,

  /** Timeout de escaneo de dispositivos (ms) */
  scanTimeout: IS_IOS ? 8000 : 10000,

  /** En Android se necesitan permisos adicionales para BLE */
  requiresLocationForBLE: IS_ANDROID,

  /** Android 12+ requiere permisos BLUETOOTH_CONNECT y BLUETOOTH_SCAN */
  requiresNewBLEPermissions: IS_ANDROID && Number(Platform.Version) >= 31,
};

// ─── Configuración de GPS/Ubicación ──────────────────────────────────────────

export const locationConfig = {
  /** Precisión de GPS */
  accuracy: 'high' as const,

  /** Timeout para obtener ubicación (ms) */
  timeout: IS_IOS ? 5000 : 8000,

  /** Distancia mínima entre actualizaciones (metros) */
  distanceFilter: 10,
};

// ─── Configuración de Almacenamiento ─────────────────────────────────────────

export const storageKeys = {
  SAVED_PRINTER_MAC: 'SAVED_PRINTER_MAC',
  AUTH_SESSION: 'AUTH_SESSION',
  APP_SETTINGS: 'APP_SETTINGS',
  LAST_SCAN_MODE: 'LAST_SCAN_MODE',
};

// ─── Temas y Colores ─────────────────────────────────────────────────────────

export const theme = {
  colors: {
    background: '#09090b',
    surface: '#18181b',
    surfaceLight: '#27272a',
    primary: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    text: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    border: '#27272a',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
};

// ─── Exportación por defecto ─────────────────────────────────────────────────

const platformConfig = {
  IS_IOS,
  IS_ANDROID,
  PLATFORM,
  ui: platformUI,
  camera: cameraConfig,
  bluetooth: bluetoothConfig,
  location: locationConfig,
  storage: storageKeys,
  theme,
};

export default platformConfig;