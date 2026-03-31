import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';

export interface GPSCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export function useGPSValidation() {
  const [permissionResponse, requestPermission] = Location.useForegroundPermissions();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const locationRef = useRef<GPSCoords | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    const startWatching = async () => {
      if (!permissionResponse?.granted) {
        const { granted } = await requestPermission();
        if (!granted) {
          logger.warn('GPS permission denied', {}, 'useGPSValidation');
          return;
        }
      }

      try {
        // Start watching for location changes to keep it "warm"
        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            const coords: GPSCoords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || 0,
              timestamp: location.timestamp,
            };
            locationRef.current = coords;
            setCurrentLocation(location);
            logger.debug('GPS location updated (warm)', {
              lat: coords.latitude.toFixed(4),
              lon: coords.longitude.toFixed(4),
              acc: coords.accuracy.toFixed(0)
            }, 'useGPSValidation');
          }
        );
      } catch (err) {
        logger.error('Error starting GPS watch', err, 'useGPSValidation');
      }
    };

    startWatching();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [permissionResponse?.granted]);

  /**
   * Gets the most recent GPS location immediately if available, 
   * otherwise tries to get a fresh one once.
   */
  const getValidatedLocation = async (): Promise<GPSCoords | null> => {
    // If we have a warm location that's not too old (e.g. < 30s)
    if (locationRef.current && Date.now() - locationRef.current.timestamp < 30000) {
      logger.info('Using warm GPS location', locationRef.current, 'useGPSValidation');
      return locationRef.current;
    }

    // Otherwise, try one last time synchronously but with a timeout or fallback
    try {
      logger.info('Warm location stale or missing, getting fresh position...', {}, 'useGPSValidation');
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords: GPSCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0,
        timestamp: loc.timestamp,
      };
      locationRef.current = coords;
      return coords;
    } catch (err) {
      logger.error('Failed to get fresh GPS location', err, 'useGPSValidation');
      return null;
    }
  };

  return {
    currentLocation,
    getValidatedLocation,
    permissionGranted: permissionResponse?.granted
  };
}
