import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { OrdersStackParamList } from '../../../navigation/OrdersNavigator';

type RateOrderScreenRouteProp = RouteProp<OrdersStackParamList, 'RateOrder'>;

interface Props {
  route: RateOrderScreenRouteProp;
}

export const RateOrderScreen: React.FC<Props> = ({ route: _route }) => {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }
    Alert.alert('Success', 'Thank you for your feedback!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rate Your Experience</Text>

      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Text style={styles.star}>{star <= rating ? '⭐' : '☆'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Review (Optional)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Share your experience..."
        value={review}
        onChangeText={setReview}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Submit Rating</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  star: {
    fontSize: 40,
    marginHorizontal: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
