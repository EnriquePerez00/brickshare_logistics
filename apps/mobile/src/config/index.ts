/**
 * Configuración centralizada de la aplicación mobile
 *
 * Uso:
 *   import { theme, IS_IOS, cameraConfig } from '../config';
 *   import platformConfig from '../config';
 */

export {
  default as platformConfig,
  IS_IOS,
  IS_ANDROID,
  PLATFORM,
  platformUI,
  cameraConfig,
  bluetoothConfig,
  locationConfig,
  storageKeys,
  theme,
} from './platform';