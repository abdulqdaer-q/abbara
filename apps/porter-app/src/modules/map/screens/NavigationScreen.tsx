import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export const NavigationScreen: React.FC = () => {
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
        <Marker coordinate={{ latitude: 37.78825, longitude: -122.4324 }} title="Destination" />
      </MapView>
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>Navigate to pickup location</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  infoCard: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5 },
  infoText: { fontSize: 16, fontWeight: 'bold' },
});
