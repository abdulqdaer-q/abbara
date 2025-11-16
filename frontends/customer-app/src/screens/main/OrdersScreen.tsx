import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { colors, spacing, typography } from '../../utils/theme';

export const OrdersScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.emptyText}>No orders yet. Create your first order to get started!</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border.primary },
  title: { ...typography.h4, color: colors.text.primary },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  emptyText: { ...typography.body1, color: colors.text.tertiary, textAlign: 'center' },
});
