import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { useAuth } from '../../hooks/useAuth';
import { colors, spacing, typography } from '../../utils/theme';

export const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {user?.displayName}!</Text>
          <Text style={styles.subtitle}>Where do you need help moving today?</Text>
        </View>
        <Button mode="contained" onPress={() => navigation.navigate('CreateOrder')} style={styles.createOrderButton} contentStyle={styles.buttonContent} icon="plus-circle">Create New Order</Button>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <QuickActionCard icon="🚚" title="Move Items" description="Book porters for moving" onPress={() => navigation.navigate('CreateOrder')} />
            <QuickActionCard icon="📦" title="Delivery" description="Send packages" onPress={() => navigation.navigate('CreateOrder')} />
            <QuickActionCard icon="🏠" title="Home Moving" description="Full home relocation" onPress={() => navigation.navigate('CreateOrder')} />
            <QuickActionCard icon="📋" title="My Orders" description="View order history" onPress={() => navigation.navigate('Main')} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Text style={styles.emptyText}>No recent orders</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const QuickActionCard = ({ icon, title, description, onPress }: any) => (
  <Card style={styles.quickActionCard} onPress={onPress}>
    <Card.Content style={styles.quickActionContent}>
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionTitle}>{title}</Text>
      <Text style={styles.quickActionDescription}>{description}</Text>
    </Card.Content>
  </Card>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.lg },
  header: { marginBottom: spacing.xl },
  greeting: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.sm },
  subtitle: { ...typography.body1, color: colors.text.secondary },
  createOrderButton: { borderRadius: 12, marginBottom: spacing.xl },
  buttonContent: { paddingVertical: spacing.sm },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h5, color: colors.text.primary, marginBottom: spacing.md },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickActionCard: { width: '48%', borderRadius: 12 },
  quickActionContent: { alignItems: 'center', gap: spacing.xs },
  quickActionIcon: { fontSize: 32 },
  quickActionTitle: { ...typography.h6, textAlign: 'center' },
  quickActionDescription: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
  emptyText: { ...typography.body2, color: colors.text.tertiary, textAlign: 'center', padding: spacing.lg },
});
