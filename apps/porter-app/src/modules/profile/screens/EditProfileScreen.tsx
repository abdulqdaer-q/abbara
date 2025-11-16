import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { updateUser } from '../../../store/slices/authSlice';

export const EditProfileScreen: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const [name, setName] = useState(user?.name || '');

  const handleSave = () => {
    dispatch(updateUser({ name }));
    Alert.alert('Success', 'Profile updated successfully');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  saveButton: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 30 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
