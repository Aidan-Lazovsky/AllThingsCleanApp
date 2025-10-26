import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function LoadingSpinner({ 
  message = 'Loading...', 
  size = 'large',
  color = '#1a1a1a',
  style 
}) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});