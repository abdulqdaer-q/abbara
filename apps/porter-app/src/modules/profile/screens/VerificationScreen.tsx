import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export const VerificationScreen: React.FC = () => {
  const handleUploadDocument = (docType: string) => {
    Alert.alert('Upload', `Upload ${docType}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verification Documents</Text>
      <Text style={styles.subtitle}>Upload the following documents for verification</Text>

      <TouchableOpacity style={styles.docButton} onPress={() => handleUploadDocument('Driver License')}>
        <Text style={styles.docButtonText}>Driver License</Text>
        <Text style={styles.docStatus}>Not uploaded</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.docButton} onPress={() => handleUploadDocument('Vehicle Registration')}>
        <Text style={styles.docButtonText}>Vehicle Registration</Text>
        <Text style={styles.docStatus}>Not uploaded</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.docButton} onPress={() => handleUploadDocument('Insurance')}>
        <Text style={styles.docButtonText}>Insurance</Text>
        <Text style={styles.docStatus}>Not uploaded</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 30 },
  docButton: { backgroundColor: '#f5f5f5', padding: 20, borderRadius: 8, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docButtonText: { fontSize: 16, fontWeight: '600' },
  docStatus: { fontSize: 12, color: '#FF9800' },
});
