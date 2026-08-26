import { api } from './client';
import type { SteamFamilyImportResult, UserGamePage, UserGameQuery, UserGameResult, UserGameStatus } from '../types';

export function getUserGames(query: UserGameQuery, token: string, signal?: AbortSignal): Promise<UserGamePage> {
  const params = new URLSearchParams();
  params.set('playable', String(query.playable ?? true));
  if (query.played !== undefined) params.set('played', String(query.played));
  if (query.status) params.set('status', query.status);
  if (query.uncategorized) params.set('uncategorized', 'true');
  if (query.source) params.set('source', query.source);
  query.genreIds?.forEach(id => params.append('genreIds', String(id)));
  if (query.title?.trim()) params.set('title', query.title.trim());
  if (query.sort) params.set('sort', query.sort);
  if (query.sortDirection) params.set('sortDirection', query.sortDirection);
  params.set('offset', String(query.offset ?? 0));
  params.set('limit', String(query.limit ?? 50));
  return api.get<UserGamePage>(`/users/me/games?${params.toString()}`, { token, signal });
}

export function importSteamFamilyLibrary(file: File, token: string, signal?: AbortSignal): Promise<SteamFamilyImportResult> {
  const body = new FormData();
  body.append('file', file);
  return api.postForm<SteamFamilyImportResult>('/users/me/games/import/steam-family', body, token, signal);
}

export function updateUserGameStatus(
  steamAppId: number,
  status: UserGameStatus | null,
  token: string,
): Promise<UserGameResult> {
  return api.patch<UserGameResult>(`/users/me/games/${steamAppId}/status`, { status }, token);
}
