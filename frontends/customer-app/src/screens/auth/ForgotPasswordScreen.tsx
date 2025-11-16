import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { authService } from '../../services/auth.service';
import { colors, spacing, typography } from '../../utils/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!emailOrPhone) {
      Alert.alert('Error', 'Please enter your email or phone');
      return;
    }

    setIsLoading(true);
    try {
      await authService.requestPasswordReset(emailOrPhone);
      Alert.alert('Success', 'Password reset instructions sent!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your email or phone to receive reset instructions</Text>
        </View>
        <View style={styles.form}>
          <TextInput label="Email or Phone" value={emailOrPhone} onChangeText={setEmailOrPhone} mode="outlined" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <Button mode="contained" onPress={handleResetPassword} loading={isLoading} disabled={isLoading} style={styles.button} contentStyle={styles.buttonContent}>Send Reset Link</Button>
          <Button mode="text" onPress={() => navigation.goBack()}>Back to Login</Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  header: { marginBottom: spacing.xl },
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.sm },
  subtitle: { ...typography.body1, color: colors.text.secondary },
  form: { gap: spacing.md },
  input: { backgroundColor: colors.white },
  button: { marginTop: spacing.md, borderRadius: 12 },
  buttonContent: { paddingVertical: spacing.sm },
});
