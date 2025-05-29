// polyfill.js - Crear este archivo en la raíz del proyecto
import {Buffer} from 'buffer';

// Hacer Buffer disponible globalmente
global.Buffer = Buffer;

// Si necesitas otros polyfills para crypto, etc.
import 'react-native-get-random-values';