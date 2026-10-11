export type RootStack = {
  Main: undefined;
  Details: { id: string };
  Player: { id: string; episodeId?: string; offline?: boolean };
  Profile: undefined;
  Downloads: undefined;
  Settings: undefined;
};
export type TabStack = { Home: undefined; Movies: undefined; Series: undefined; Search: undefined; Favorites: undefined };
