import React, { useEffect, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { SyncProvider } from './src/hooks/useSync';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { ThemeProvider, useTheme } from './src/hooks/useTheme';

function AppContent() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const colorScheme = useColorScheme();

  const isDark = theme === 'system' ? colorScheme === 'dark' : theme === 'dark';

  if (loading) {
    return null; // Or a splash screen
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#1a1a1a' : '#ffffff'}
      />
      <NavigationContainer
        theme={{
          ...(isDark ? DarkTheme : DefaultTheme),
          colors: {
            ...(isDark ? DarkTheme : DefaultTheme).colors,
            primary: '#2dbe60',
            background: isDark ? '#1a1a1a' : '#ffffff',
            card: isDark ? '#2d2d2d' : '#ffffff',
            text: isDark ? '#ffffff' : '#1a1a1a',
            border: isDark ? '#404040' : '#e0e0e0',
            notification: '#2dbe60',
          },
        }}
      >
        {user ? (
          <SyncProvider>
            <MainNavigator />
          </SyncProvider>
        ) : (
          <AuthNavigator />
        )}
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
