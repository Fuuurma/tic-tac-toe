import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tictactoe.app',
  appName: 'TicTacToe',
  webDir: 'out',
  server: {
    // Production server URL - update this after Railway deployment
    // Format: https://your-app-name.railway.app
    hostname: 'tictactoe.railway.app',
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: '#1c1f33',
      showSpinner: true,
      spinnerColor: '#fbbf24'
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1c1f33'
    }
  },
  ios: {
    contentInset: 'always'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
