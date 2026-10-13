import type { NavigatorScreenParams } from '@react-navigation/native';
export type RootStack = {
  Main: NavigatorScreenParams<TabStack> | undefined;
  Details: { id: string };
  Player: { id: string; episodeId?: string; offline?: boolean };
  Profile: undefined;
  Downloads: undefined;
  Settings: undefined;
};
export type TabStack = { Home: undefined; Movies: undefined; Series: undefined; Search: { narrator?: string } | undefined; Narrators: undefined; Favorites: undefined };
