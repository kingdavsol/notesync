import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Feather';

import NotesScreen from '../screens/NotesScreen';
import NoteEditorScreen from '../screens/NoteEditorScreen';
import SearchScreen from '../screens/SearchScreen';
import NotebooksScreen from '../screens/NotebooksScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type MainStackParamList = {
  MainTabs: undefined;
  NoteEditor: { noteId?: string; folderId?: string };
  Search: undefined;
};

export type TabParamList = {
  Notes: undefined;
  Notebooks: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Notes':
              iconName = 'file-text';
              break;
            case 'Notebooks':
              iconName = 'folder';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2dbe60',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#2dbe60',
        },
        headerTintColor: '#fff',
      })}
    >
      <Tab.Screen
        name="Notes"
        component={NotesScreen}
        options={{
          title: 'All Notes',
        }}
      />
      <Tab.Screen
        name="Notebooks"
        component={NotebooksScreen}
        options={{
          title: 'Notebooks',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NoteEditor"
        component={NoteEditorScreen}
        options={{
          title: 'Edit Note',
          headerStyle: {
            backgroundColor: '#2dbe60',
          },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          headerStyle: {
            backgroundColor: '#2dbe60',
          },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}
