import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { colors, spacing, typography } from '../../utils/theme';

export const OrderTrackingScreen = ({ route }: any) => {
  const { orderId } = route.params;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <MapView style={styles.map} initialRegion={{ latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.0922, longitudeDelta: 0.0421 }}>
        <Marker coordinate={{ latitude: 37.78825, longitude: -122.4324 }} title="Porter Location" />
      </MapView>
      <View style={styles.info}>
        <Text style={styles.label}>Tracking Order: {orderId}</Text>
        <Text style={styles.status}>Porter is on the way...</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  info: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, backgroundColor: colors.white, padding: spacing.md, borderRadius: 12, ...require('../../utils/theme').shadows.md },
  label: { ...typography.body2, color: colors.text.secondary },
  status: { ...typography.h6, color: colors.text.primary, marginTop: spacing.xs },
});
