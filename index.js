// index.js - Agregar esta línea al principio
import './polyfill';

// Resto de tu configuración de index.js
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);