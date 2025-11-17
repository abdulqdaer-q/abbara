import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../utils/theme';

export const CreateOrderScreen = ({ navigation }: any) => {
  const [vehicleType, setVehicleType] = useState('sedan');
  const [portersRequired, setPortersRequired] = useState('1');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleCreateOrder = () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert('Error', 'Please enter pickup and dropoff addresses');
      return;
    }
    Alert.alert('Success', 'Order created successfully!', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Vehicle Type</Text>
          <SegmentedButtons value={vehicleType} onValueChange={setVehicleType} buttons={[
            { value: 'sedan', label: 'Sedan' },
            { value: 'suv', label: 'SUV' },
            { value: 'van', label: 'Van' },
            { value: 'truck', label: 'Truck' },
          ]} />
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Number of Porters</Text>
          <SegmentedButtons value={portersRequired} onValueChange={setPortersRequired} buttons={[
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4+', label: '4+' },
          ]} />
        </View>
        <View style={styles.section}>
          <TextInput label="Pickup Address" value={pickupAddress} onChangeText={setPickupAddress} mode="outlined" left={<TextInput.Icon icon="map-marker" />} />
        </View>
        <View style={styles.section}>
          <TextInput label="Dropoff Address" value={dropoffAddress} onChangeText={setDropoffAddress} mode="outlined" left={<TextInput.Icon icon="map-marker-check" />} />
        </View>
        <View style={styles.section}>
          <TextInput label="Special Instructions (Optional)" value={instructions} onChangeText={setInstructions} mode="outlined" multiline numberOfLines={4} />
        </View>
        <Button mode="contained" onPress={handleCreateOrder} style={styles.createButton} contentStyle={styles.buttonContent}>Create Order</Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.lg },
  section: { marginBottom: spacing.lg },
  label: { ...typography.h6, color: colors.text.primary, marginBottom: spacing.sm },
  createButton: { borderRadius: 12, marginTop: spacing.md },
  buttonContent: { paddingVertical: spacing.sm },
});
