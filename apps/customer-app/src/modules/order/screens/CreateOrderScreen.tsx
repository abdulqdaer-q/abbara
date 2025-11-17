import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';
import { useDispatch } from 'react-redux';
import { addOrder } from '../../../store/slices/orderSlice';
import { trpcClient } from '../../../services/trpc';
import { VehicleType } from '@movenow/common';

type CreateOrderScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'CreateOrder'>;

interface Props {
  navigation: CreateOrderScreenNavigationProp;
}

export const CreateOrderScreen: React.FC<Props> = ({ navigation }) => {
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('van');
  const [porterCount, setPorterCount] = useState(2);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();

  const handleCreateOrder = async () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert('Error', 'Please enter pickup and dropoff addresses');
      return;
    }

    setIsLoading(true);

    try {
      const result = await trpcClient.orders.createOrder.mutate({
        pickup: { address: pickupAddress, lat: 0, lng: 0 }, // In real app, geocode address
        dropoff: { address: dropoffAddress, lat: 0, lng: 0 },
        vehicleType,
        porterCount,
        notes,
      });

      dispatch(addOrder(result));
      Alert.alert('Success', 'Order created successfully!');
      navigation.navigate('OrderTracking', { orderId: result.id });
    } catch (error: any) {
      console.error('Create order error:', error);
      Alert.alert('Error', error.message || 'Failed to create order');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Pickup Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter pickup address"
        value={pickupAddress}
        onChangeText={setPickupAddress}
      />

      <Text style={styles.label}>Dropoff Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter dropoff address"
        value={dropoffAddress}
        onChangeText={setDropoffAddress}
      />

      <Text style={styles.label}>Vehicle Type</Text>
      <View style={styles.vehicleTypeContainer}>
        {(['sedan', 'suv', 'van', 'truck'] as VehicleType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.vehicleTypeButton,
              vehicleType === type && styles.vehicleTypeButtonActive,
            ]}
            onPress={() => setVehicleType(type)}
          >
            <Text
              style={[
                styles.vehicleTypeText,
                vehicleType === type && styles.vehicleTypeTextActive,
              ]}
            >
              {type.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Number of Porters: {porterCount}</Text>
      <View style={styles.counterContainer}>
        <TouchableOpacity
          style={styles.counterButton}
          onPress={() => setPorterCount(Math.max(0, porterCount - 1))}
        >
          <Text style={styles.counterButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.counterValue}>{porterCount}</Text>
        <TouchableOpacity
          style={styles.counterButton}
          onPress={() => setPorterCount(Math.min(10, porterCount + 1))}
        >
          <Text style={styles.counterButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Additional Notes (Optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Enter any special instructions"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity
        style={[styles.createButton, isLoading && styles.createButtonDisabled]}
        onPress={handleCreateOrder}
        disabled={isLoading}
      >
        <Text style={styles.createButtonText}>
          {isLoading ? 'Creating...' : 'Create Order'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vehicleTypeButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  vehicleTypeButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  vehicleTypeText: {
    color: '#666',
    fontWeight: '600',
  },
  vehicleTypeTextActive: {
    color: '#fff',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  counterButton: {
    backgroundColor: '#2196F3',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  counterValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 30,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
