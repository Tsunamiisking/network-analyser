import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
      }}
    >
      <Tabs.Screen
        name="(tabs)/heatmap"
        options={{
          title: 'Heatmap',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(tabs)/best"
        options={{
          title: 'Best Network',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="signal-cellular-alt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(tabs)/history"
        options={{
          title: 'My History',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="history" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(tabs)/report"
        options={{
          title: 'Report Issue',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="report-problem" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}