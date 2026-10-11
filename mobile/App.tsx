import React from 'react';
import { Pressable, Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { RootStack, TabStack } from './src/navigation';
import { StoreProvider } from './src/store';
import { HomeScreen, CatalogScreen, FavoritesScreen, DetailsScreen, ProfileScreen, DownloadsScreen, SettingsScreen } from './src/screens';
import { PlayerScreen } from './src/player';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStack>();
const Tabs = createBottomTabNavigator<TabStack>();
const icons = { Home: 'home-outline', Movies: 'film-outline', Series: 'tv-outline', Search: 'search-outline', Favorites: 'heart-outline' } as const;
function MainTabs() {
  return <Tabs.Navigator backBehavior="history" screenOptions={({ route }) => ({
    headerShown: false, tabBarActiveTintColor: colors.brand, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} color={color} size={size} />,
  })}><Tabs.Screen name="Home" component={HomeScreen} /><Tabs.Screen name="Movies">{() => <CatalogScreen type="movie" />}</Tabs.Screen>
    <Tabs.Screen name="Series">{() => <CatalogScreen type="tv" />}</Tabs.Screen><Tabs.Screen name="Search">{() => <CatalogScreen search />}</Tabs.Screen><Tabs.Screen name="Favorites" component={FavoritesScreen} />
  </Tabs.Navigator>;
}
export default function App() {
  return <SafeAreaProvider><StoreProvider><StatusBar style="light" /><NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, primary: colors.brand, background: colors.background, card: colors.surface } }}>
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Main" component={MainTabs} options={({ navigation }) => ({
        headerTitle: () => <Text style={{ color: colors.text, fontWeight: '900', fontSize: 21, fontStyle: 'italic' }}><Text style={{ color: colors.gold }}>★ </Text>FilimeHome</Text>,
        headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={12} onPress={() => navigation.navigate('Profile')}><Ionicons name="person-circle-outline" color={colors.text} size={30} /></Pressable>,
      })} />
      <Stack.Screen name="Details" component={DetailsScreen} options={{ title: 'Movie details' }} /><Stack.Screen name="Player" component={PlayerScreen} options={{ title: 'Now playing' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} /><Stack.Screen name="Downloads" component={DownloadsScreen} /><Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  </NavigationContainer></StoreProvider></SafeAreaProvider>;
}
