import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, Button, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../utils/theme';

export const OrderDetailsScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <Text style={styles.label}>Order ID:</Text>
              <Text style={styles.value}>{orderId}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <Chip>Pending</Chip>
            </View>
          </Card.Content>
        </Card>
        <Button mode="contained" onPress={() => navigation.navigate('OrderTracking', { orderId })} style={styles.button}>Track Order</Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  content: { padding: spacing.lg },
  card: { borderRadius: 12, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  label: { ...typography.body1, color: colors.text.secondary },
  value: { ...typography.body1, color: colors.text.primary, fontWeight: '600' },
  button: { borderRadius: 12 },
});
