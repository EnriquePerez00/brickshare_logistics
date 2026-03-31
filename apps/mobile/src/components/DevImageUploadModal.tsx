import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';

interface DevImageUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onProcess: (data: string) => void;
  mode: 'dropoff' | 'pickup';
  pickedImageUri: string | null;
  decoding: boolean;
  decodeStatus: 'idle' | 'success' | 'failed';
  imageCodeInput: string;
  setImageCodeInput: (text: string) => void;
  setDecodeStatus: (status: 'idle' | 'success' | 'failed') => void;
}

export const DevImageUploadModal: React.FC<DevImageUploadModalProps> = ({ 
  visible, 
  onClose, 
  onProcess, 
  mode,
  pickedImageUri,
  decoding,
  decodeStatus,
  imageCodeInput,
  setImageCodeInput,
  setDecodeStatus
}) => {

  const handleProcess = () => {
    if (imageCodeInput.trim()) {
      onProcess(imageCodeInput.trim());
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
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
              onPress={onClose}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalScanBtn, (!imageCodeInput.trim() || decoding) && { opacity: 0.5 }]} 
              disabled={!imageCodeInput.trim() || decoding}
              onPress={handleProcess}
            >
              <Text style={styles.modalScanText}>🚀 Procesar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  imageModalContent: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalTitle: {
    color: '#fafafa',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
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
});
