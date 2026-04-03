import React, { useState } from 'react';
import { Alert, StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '@brickshare/shared';
import { logger } from '../utils/logger';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para Recuperación de Contraseña
  const [modalVisible, setModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const signInWithEmail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password,
      });

      if (error) {
        logger.error('❌ [LoginScreen] Auth failed', { message: error.message }, 'LoginScreen');
        Alert.alert('Error de Autenticación', error.message);
      }
    } catch (err: any) {
      logger.error('❌ [LoginScreen] Login error', err, 'LoginScreen');
      Alert.alert('Error', 'Error inesperado durante el login');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      Alert.alert('Atención', 'Por favor, introduce tu correo electrónico.');
      return;
    }
    
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.toLowerCase());

      if (error) {
        logger.error('❌ [LoginScreen] Reset failed', { message: error.message }, 'LoginScreen');
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Correo Enviado ✅',
          'Hemos enviado un enlace a tu correo para restablecer la contraseña.',
          [{ text: 'OK', onPress: () => setModalVisible(false) }]
        );
      }
    } catch (err: any) {
      logger.error('❌ [LoginScreen] Reset error', err, 'LoginScreen');
      Alert.alert('Error', 'Error inesperado');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🚚 Brickshare Logistics</Text>
        <Text style={styles.subtitle}>Terminal de Punto de Conveniencia (PUDO)</Text>
        <Text style={styles.statusText}>Conectando con DB remota (Brickshare)...</Text>

        <TextInput
          style={styles.input}
          onChangeText={setEmail}
          value={email}
          placeholder="Correo electrónico"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          onChangeText={setPassword}
          value={password}
          secureTextEntry={true}
          placeholder="Contraseña"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={signInWithEmail} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.forgotButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.forgotText}>¿Has olvidado tu contraseña?</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Recuperación de Contraseña */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Recuperar Contraseña</Text>
            <Text style={styles.modalText}>
              Introduce el correo asociado a tu cuenta para recibir un enlace de recuperación.
            </Text>

            <TextInput
              style={styles.input}
              onChangeText={setResetEmail}
              value={resetEmail}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setModalVisible(false)}
                disabled={resetLoading}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm, resetLoading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#09090b', // zinc-950
  },
  card: {
    marginHorizontal: 20,
    padding: 24,
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fafafa',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#71717a',
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#27272a', // zinc-800
    color: '#fafafa',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    width: '100%',
  },
  button: {
    backgroundColor: '#3b82f6', // blue-500
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  forgotText: {
    color: '#a1a1aa',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  // Estilos del Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalView: {
    width: '85%',
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fafafa',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#a1a1aa',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#3f3f46', // zinc-700
    marginRight: 8,
  },
  modalButtonConfirm: {
    backgroundColor: '#10b981', // emerald-500
    marginLeft: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
