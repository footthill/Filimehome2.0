import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { RootStack, TabStack } from './src/navigation';
import { StoreProvider } from './src/store';
import { HomeScreen, CatalogScreen, ExploreScreen, NarratorsScreen, FavoritesScreen, DetailsScreen, ProfileScreen, DownloadsScreen, SettingsScreen } from './src/screens';
import { PlayerScreen } from './src/player';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStack>();
const Tabs = createBottomTabNavigator<TabStack>();
const icons = { Home: 'home-outline', Movies: 'film-outline', Series: 'tv-outline', Search: 'search-outline', Favorites: 'heart-outline', Narrators: 'mic-outline' } as const;
function MainTabs() {
  const insets = useSafeAreaInsets();
  return <Tabs.Navigator safeAreaInsets={{ bottom: 0 }} backBehavior="history" screenOptions={({ route }) => ({
    headerShown: false, tabBarActiveTintColor: colors.gold, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { position: 'absolute', bottom: Math.max(insets.bottom, 12), left: 16, right: 16, height: 64, paddingBottom: 8, paddingTop: 8, backgroundColor: colors.navigation, borderRadius: 32, borderWidth: 1, borderColor: colors.border, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
    tabBarIcon: ({ color, size, focused }) => <View style={{ alignItems: 'center' }}><Ionicons name={icons[route.name]} color={color} size={focused ? size + 1 : size} />{focused && <View style={{ position: 'absolute', bottom: -5, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />}</View>,
  })}><Tabs.Screen name="Home" component={HomeScreen} /><Tabs.Screen name="Movies" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}>{() => <CatalogScreen type="movie" />}</Tabs.Screen>
    <Tabs.Screen name="Series" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}>{() => <CatalogScreen type="tv" />}</Tabs.Screen><Tabs.Screen name="Search" component={ExploreScreen} options={{ title: 'Explore' }} /><Tabs.Screen name="Narrators" component={NarratorsScreen} options={{ title: 'Abasobanuzi' }} /><Tabs.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Collection' }} />
  </Tabs.Navigator>;
}
export default function App() {
  return <SafeAreaProvider><StoreProvider><StatusBar style="light" /><NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, primary: colors.gold, background: colors.background, card: colors.surface } }}>
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.gold, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Main" component={MainTabs} options={({ navigation }) => ({
        headerTitle: () => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ backgroundColor: colors.gold, borderRadius: 6, padding: 5 }}><Ionicons name="star" size={16} color="#000" /></View><Text style={{ color: colors.text, fontWeight: '800', fontSize: 20, fontStyle: 'italic', letterSpacing: -0.6 }}>FilimeHome</Text></View>,
        headerRight: () => <View style={{ flexDirection: 'row', gap: 20 }}><Pressable accessibilityRole="button" accessibilityLabel="Search catalog" hitSlop={8} onPress={() => navigation.navigate('Main', { screen: 'Search', params: { narrator: undefined } })}><Ionicons name="search-outline" color={colors.text} size={24} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={8} onPress={() => navigation.navigate('Profile')}><Ionicons name="person-circle-outline" color={colors.brand} size={28} /></Pressable></View>,
      })} />
      <Stack.Screen name="Details" component={DetailsScreen} options={{ title: 'Movie details' }} /><Stack.Screen name="Player" component={PlayerScreen} options={{ title: 'Now playing' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} /><Stack.Screen name="Downloads" component={DownloadsScreen} /><Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  </NavigationContainer></StoreProvider></SafeAreaProvider>;
}
