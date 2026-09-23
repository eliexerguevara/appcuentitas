import { StyleSheet, Platform } from 'react-native';

export const globalStyles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }
    })
  },
  
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonPrimary: {
    backgroundColor: '#3b5bdb',
  },
  
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  input: {
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  }
});

export const colors = {
  primary: '#3b5bdb',
  success: '#2f9e44',
  danger: '#e03131',
  warning: '#e8890c',
  info: '#1c7ed6',
  dark: '#343a40',
  light: '#f8f9fa'
};
// Color de los textos de ejemplo (placeholder) en los campos: gris claro para
// que no se confundan con un valor ya cargado.
export const PLACEHOLDER_COLOR = '#b8bec5';
