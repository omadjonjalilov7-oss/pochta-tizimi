import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.asakamotors.edo',
  appName: 'Asaka EDO',
  webDir: 'dist',
  server: {
    url: 'https://edo.asaka-motors.uz',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
