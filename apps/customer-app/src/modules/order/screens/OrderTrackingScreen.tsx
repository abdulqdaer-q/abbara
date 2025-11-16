import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { RouteProp } from '@react-navigation/native';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

type OrderTrackingScreenRouteProp = RouteProp<HomeStackParamList, 'OrderTracking'>;

interface Props {
  route: OrderTrackingScreenRouteProp;
}

export const OrderTrackingScreen: React.FC<Props> = ({ route }) => {
  const { orderId } = route.params;

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker
          coordinate={{ latitude: 37.78825, longitude: -122.4324 }}
          title="Porter Location"
        />
      </MapView>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Order #{orderId.slice(0, 8)}</Text>
        <Text style={styles.infoText}>Status: In Progress</Text>
        <Text style={styles.infoText}>Porter: John Doe</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  infoCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});
