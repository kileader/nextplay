import { api } from './client';
import type { NextPlayPick, NextPlayRequest } from '../types';

export function getNextPlayPicks(request: NextPlayRequest, token: string): Promise<NextPlayPick[]> {
  return api.post<NextPlayPick[]>('/users/me/next-picks', request, token);
}
