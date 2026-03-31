import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';

interface DevSimulationModalProps {
  visible: boolean;
  onClose: () => void;
  onProcess: (data: string) => void;
  mode?: 'dropoff' | 'pickup';
}

export const DevSimulationModal: React.FC<DevSimulationModalProps> = ({ visible, onClose, onProcess, mode = 'dropoff' }) => {
  const [simInput, setSimInput] = useState('');
  const simInputRef = useRef<TextInput>(null);

  const handleProcess = () => {
    if (simInput.trim()) {
      onProcess(simInput.trim());
      setSimInput('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            📦 Simular Código QR
          </Text>
          <Text style={styles.modalSubtitle}>
            Pega aquí el código QR escaneado (delivery o pickup).
            El sistema detectará automáticamente el tipo de operación.
          </Text>
          <TextInput
            ref={simInputRef}
            style={styles.modalInput}
            value={simInput}
            onChangeText={setSimInput}
            placeholder="ej: BS-DEL-7A2D335C-8FA o BS-PU-ABC123DEF"
            placeholderTextColor="#71717a"
            multiline
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.modalCancelBtn} 
              onPress={() => {
                setSimInput('');
                onClose();
              }}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalScanBtn, !simInput.trim() && { opacity: 0.5 }]} 
              disabled={!simInput.trim()}
              onPress={handleProcess}
            >
              <Text style={styles.modalScanText}>🚀 Procesar Scan</Text>
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
});
