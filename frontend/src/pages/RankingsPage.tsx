import { Fragment, useEffect, useReducer, useCallback, useState, useRef, useId } from 'react';
import './RankingsPage.css';
import { getRankings } from '../api/rankings';
import { getPlatforms, getGenres } from '../api/metadata';
import { createConfig } from '../api/rankingConfigs';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import SavedConfigs from '../components/SavedConfigs';
import MultiSelect from '../components/MultiSelect';
import type { MetadataItem, OnboardingPrefs, RankingConfig, RankingPage, RankingQuery, RankingResult, RankingSort, SortDirection } from '../types';

const PAGE_LIMIT = 50;

const RECENT_SEARCHES_KEY = 'bgr_search_recent';
const RECENT_SEARCHES_MAX = 8;

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_SEARCHES_MAX);
  } catch {
    return [];
  }
}

function saveRecentSearches(entries: string[]) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(entries.slice(0, RECENT_SEARCHES_MAX)));
  } catch {
    /* ignore quota */
  }
}

function pushRecentSearch(title: string) {
  const t = title.trim();
  if (!t) return;
  const prev = loadRecentSearches().filter(s => s.toLowerCase() !== t.toLowerCase());
  saveRecentSearches([t, ...prev]);
}

const HIDDEN_GAMES_KEY = 'bgr_hidden_games';

function loadHiddenGameIds(): Set<number> {
  try {
    const raw = localStorage.getItem(HIDDEN_GAMES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const ids = new Set<number>();
    for (const x of parsed) {
      if (typeof x === 'number' && Number.isInteger(x) && x > 0) ids.add(x);
    }
    return ids;
  } catch {
    return new Set();
  }
}

function saveHiddenGameIds(ids: Set<number>) {
  try {
    localStorage.setItem(HIDDEN_GAMES_KEY, JSON.stringify([...ids].sort((a, b) => a - b)));
  } catch {
    /* ignore quota */
  }
}

function hltbSearchUrl(title: string): string {
  return `https://howlongtobeat.com/?q=${encodeURIComponent(title.trim())}`;
}

/** Only link to HLTB when we have a real match; fallback hours are not tied to an HLTB page. */
function canLinkHltbSearch(result: RankingResult): boolean {
  return result.hltbFound === true && result.hltbHours !== null;
}

function igdbPageUrl(result: RankingResult): string | null {
  const u = result.igdbUrl?.trim();
  return u ? u : null;
}

/** CheapShark search for this Steam app — user compares stores/deals on their site. */
function cheapsharkSearchBySteamUrl(steamAppId: number): string {
  return `https://www.cheapshark.com/search?steamAppID=${steamAppId}`;
}

/** CheapShark (Steam) → single deal redirect → IGDB — cover/title when no Steam id. */
function primaryCoverHref(result: RankingResult): string | null {
  if (result.steamAppId != null) return cheapsharkSearchBySteamUrl(result.steamAppId);
  if (result.cheapsharkDealUrl) return result.cheapsharkDealUrl;
  if (result.igdbUrl) return result.igdbUrl;
  return null;
}

function primaryCoverAriaLabel(result: RankingResult): string {
  if (result.steamAppId != null) {
    return `Compare PC deals for ${result.title} on CheapShark (opens in new tab)`;
  }
  if (result.cheapsharkDealUrl) return `View deal for ${result.title} (opens in new tab)`;
  if (result.igdbUrl) return `${result.title} on IGDB (opens in new tab)`;
  return '';
}

/**
 * Price link: CheapShark search when we have a Steam id; else single deal redirect if synced;
 * otherwise no link (edge: priced row without Steam or deal URL).
 */
function cardPriceHref(result: RankingResult): string | null {
  if (result.priceCents == null || result.priceCents <= 0) return null;
  if (result.steamAppId != null) return cheapsharkSearchBySteamUrl(result.steamAppId);
  if (result.cheapsharkDealUrl) return result.cheapsharkDealUrl;
  return null;
}

function cardPriceLinkLabel(result: RankingResult): string {
  if (result.steamAppId != null) {
    return `Compare PC deals for ${result.title} on CheapShark (opens in new tab)`;
  }
  if (result.cheapsharkDealUrl) {
    return `View PC deal for ${result.title} (opens in new tab)`;
  }
  return '';
}

/** Scan-friendly labels (IGDB platform ids). Fallback shortens catalog name. */
const PLATFORM_SHORT: Record<number, string> = {
  6: 'PC',
  3: 'Linux',
  14: 'Mac',
  167: 'PS5',
  169: 'XSX',
  48: 'PS4',
  49: 'XB1',
  130: 'Switch',
  612: 'NS2',
  508: 'NS2',
  7: 'PS3',
  9: 'PS2',
  8: 'PS1',
  12: '360',
  11: 'Xbox',
  46: 'Vita',
  38: 'PSP',
  37: '3DS',
  41: 'Wii U',
  5: 'Wii',
  18: 'GCN',
  21: 'DS',
  20: 'N64',
  22: 'GBA',
  24: 'GBC',
  33: 'GB',
  4: 'NES',
  19: 'SNES',
  32: 'MD',
  29: 'DC',
  39: 'iOS',
  34: 'Android',
  385: 'Quest',
  390: 'PSVR2',
  163: 'PC VR',
  165: 'PS VR',
};

function shortPlatformToken(id: number, catalog: MetadataItem[] | null): string {
  const fixed = PLATFORM_SHORT[id];
  if (fixed) return fixed;
  const name = catalog?.find(p => p.id === id)?.name;
  if (!name) return String(id);
  const compact = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (compact.length <= 8) return compact;
  return `${compact.slice(0, 7)}…`;
}

/** Windows, Mac, Linux, PC VR — CheapShark search (Steam id), else deal URL, else IGDB. */
const PC_LIKE_PLATFORM_IDS = new Set([6, 14, 3, 163]);

const PLAYSTATION_PLATFORM_IDS = new Set([167, 48, 46, 38, 7, 9, 8, 390, 165]);

const XBOX_PLATFORM_IDS = new Set([169, 49, 12, 11]);

const NINTENDO_PLATFORM_IDS = new Set([
  130, 612, 508, 41, 5, 18, 37, 21, 20, 22, 24, 33, 4, 19, 32, 29,
]);

function storefrontHrefForPlatform(platformId: number, result: RankingResult): string | null {
  const t = result.title.trim();
  if (!t) return result.igdbUrl ?? null;

  if (PC_LIKE_PLATFORM_IDS.has(platformId)) {
    if (result.steamAppId != null) return cheapsharkSearchBySteamUrl(result.steamAppId);
    if (result.cheapsharkDealUrl) return result.cheapsharkDealUrl;
    return result.igdbUrl ?? null;
  }
  if (PLAYSTATION_PLATFORM_IDS.has(platformId)) {
    return `https://store.playstation.com/en-us/search/${encodeURIComponent(t)}`;
  }
  if (XBOX_PLATFORM_IDS.has(platformId)) {
    return `https://www.xbox.com/en-US/search/shop/?q=${encodeURIComponent(t)}`;
  }
  if (NINTENDO_PLATFORM_IDS.has(platformId)) {
    return `https://www.nintendo.com/us/search/#/products?query=${encodeURIComponent(t)}`;
  }
  if (platformId === 39) {
    return `https://apps.apple.com/us/search?term=${encodeURIComponent(t)}`;
  }
  if (platformId === 34) {
    return `https://play.google.com/store/search?q=${encodeURIComponent(t)}&c=apps`;
  }
  if (platformId === 385) {
    return `https://www.meta.com/experiences/search/?q=${encodeURIComponent(t)}`;
  }
  return result.igdbUrl ?? null;
}

function storefrontLinkHint(platformId: number, result: RankingResult, href: string): string {
  if (result.igdbUrl && href === result.igdbUrl) {
    return `${result.title} on IGDB (opens in new tab)`;
  }
  if (PC_LIKE_PLATFORM_IDS.has(platformId)) {
    if (result.steamAppId != null && href === cheapsharkSearchBySteamUrl(result.steamAppId)) {
      return `Compare PC deals for ${result.title} on CheapShark (opens in new tab)`;
    }
    if (result.cheapsharkDealUrl && href === result.cheapsharkDealUrl) {
      return `Cheapest tracked PC deal for ${result.title} (opens in new tab)`;
    }
  }
  if (PLAYSTATION_PLATFORM_IDS.has(platformId)) {
    return `Search PlayStation Store for ${result.title} (opens in new tab)`;
  }
  if (XBOX_PLATFORM_IDS.has(platformId)) {
    return `Search Microsoft Store for ${result.title} (opens in new tab)`;
  }
  if (NINTENDO_PLATFORM_IDS.has(platformId)) {
    return `Search Nintendo store for ${result.title} (opens in new tab)`;
  }
  if (platformId === 39) return `Search App Store for ${result.title} (opens in new tab)`;
  if (platformId === 34) return `Search Google Play for ${result.title} (opens in new tab)`;
  if (platformId === 385) return `Search Meta Quest store for ${result.title} (opens in new tab)`;
  return `Open in new tab`;
}

type PlatformScanEntry = {
  id: number;
  label: string;
  detailName: string;
  href: string | null;
};

/** Preferred platforms first (applied filter order, else onboarding order), then catalog order. */
function sortPlatformIdsForDisplay(
  list: number[],
  catalog: MetadataItem[] | null,
  priorityOrder: number[],
): number[] {
  const listSet = new Set(list);
  const catalogOrder = catalog?.length
    ? new Map(catalog.map((p, i) => [p.id, i]))
    : null;

  const first: number[] = [];
  if (priorityOrder.length > 0) {
    for (const id of priorityOrder) {
      if (listSet.has(id)) first.push(id);
    }
  }
  const firstSet = new Set(first);
  const rest = list.filter(id => !firstSet.has(id));
  rest.sort((a, b) => (catalogOrder?.get(a) ?? 99999) - (catalogOrder?.get(b) ?? 99999));
  return [...first, ...rest];
}

/**
 * Platforms for display: optional filter = intersection with applied platform filter (non-empty).
 * Order: applied platform order (if any), else onboarding preferred order, then remaining by catalog.
 */
function buildPlatformScanEntries(
  ids: number[] | undefined,
  catalog: MetadataItem[] | null,
  appliedPlatformIds: number[] | undefined,
  preferredPlatformOrder: number[],
  result: RankingResult,
): PlatformScanEntry[] {
  let list = ids?.length ? [...ids] : [];
  if (appliedPlatformIds && appliedPlatformIds.length > 0) {
    const allowed = new Set(appliedPlatformIds);
    list = list.filter(id => allowed.has(id));
  }
  if (list.length === 0) return [];

  const priority =
    appliedPlatformIds && appliedPlatformIds.length > 0
      ? appliedPlatformIds
      : preferredPlatformOrder;
  const sortedIds = sortPlatformIdsForDisplay(list, catalog, priority);

  return sortedIds.map(id => {
    const detailName = catalog?.find(p => p.id === id)?.name ?? `Platform ${id}`;
    const label = shortPlatformToken(id, catalog);
    const href = storefrontHrefForPlatform(id, result);
    return { id, label, detailName, href };
  });
}

function PlatformScanLine({
  entries,
  result,
}: {
  entries: PlatformScanEntry[];
  result: RankingResult;
}) {
  if (entries.length === 0) {
    return <span className="platform-scan-line">—</span>;
  }
  const detailTitle = entries.map(e => e.detailName).join(', ');
  return (
    <span className="platform-scan-line" title={detailTitle}>
      {entries.map((e, i) => (
        <Fragment key={e.id}>
          {i > 0 ? <span className="platform-sep" aria-hidden> · </span> : null}
          {e.href ? (
            <a
              href={e.href}
              target="_blank"
              rel="noreferrer"
              className="platform-store-link"
              title={storefrontLinkHint(e.id, result, e.href)}
              aria-label={storefrontLinkHint(e.id, result, e.href)}
            >
              {e.label}
            </a>
          ) : (
            <span title={e.detailName}>{e.label}</span>
          )}
        </Fragment>
      ))}
    </span>
  );
}

/** Natural first-click direction per column. */
const SORT_DEFAULT_DIR: Record<RankingSort, SortDirection> = {
  VALUE_SCORE: 'DESC',
  RATING: 'DESC',
  PLAYTIME: 'DESC',
  PRICE: 'ASC',
  TITLE: 'ASC',
  RELEASE_DATE: 'DESC',
};

// --- State ---

type Filters = {
  platformIds: number[];
  genreIds: number[];
  releaseYearMin: string;
  releaseYearMax: string;
  minPriceDollars: string;
  maxPriceDollars: string;
  minPlaytimeHours: string;
  maxPlaytimeHours: string;
  title: string;
  ratingWeight: string;
  playtimeWeight: string;
  priceWeight: string;
  includeFreeToPlay: boolean;
  includeMultiplayerOnly: boolean;
  excludeAdultRated: boolean;
  sort: RankingSort;
  sortDir: SortDirection;
};

type State = {
  filters: Filters;
  appliedQuery: RankingQuery;
  offset: number;
  data: RankingPage | null;
  loading: boolean;
  /** API / network failure (hides results). */
  error: string | null;
  /** Client-side filter validation (results may still show). */
  validationError: string | null;
};

type FilterField = keyof Omit<Filters, 'platformIds' | 'genreIds' | 'sort' | 'sortDir' | 'title' | 'ratingWeight' | 'playtimeWeight' | 'priceWeight' | 'includeFreeToPlay' | 'includeMultiplayerOnly' | 'excludeAdultRated'>;
type WeightField = 'ratingWeight' | 'playtimeWeight' | 'priceWeight';
type IncludeField = 'includeFreeToPlay' | 'includeMultiplayerOnly' | 'excludeAdultRated';

type Action =
  | { type: 'SET_FILTER'; field: FilterField; value: string }
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_WEIGHT'; field: WeightField; value: string }
  | { type: 'SET_INCLUDE'; field: IncludeField; value: boolean }
  | { type: 'SET_MULTI_FILTER'; field: 'platformIds' | 'genreIds'; ids: number[] }
  | { type: 'SET_SORT'; sort: RankingSort; dir: SortDirection }
  | { type: 'APPLY_FILTERS' }
  | { type: 'LOAD_CONFIG'; config: RankingConfig }
  | { type: 'SET_OFFSET'; offset: number }
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: RankingPage }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SET_VALIDATION_ERROR'; error: string | null }
  | { type: 'APPLY_ONBOARDING'; prefs: OnboardingPrefs };

const defaultFilters: Filters = {
  platformIds: [],
  genreIds: [],
  releaseYearMin: '2000',
  releaseYearMax: '',
  minPriceDollars: '',
  maxPriceDollars: '',
  minPlaytimeHours: '',
  maxPlaytimeHours: '',
  title: '',
  ratingWeight: '1',
  playtimeWeight: '1',
  priceWeight: '1',
  includeFreeToPlay: false,
  includeMultiplayerOnly: false,
  excludeAdultRated: false,
  sort: 'VALUE_SCORE',
  sortDir: 'DESC',
};

const LAST_RANKING_FILTERS_KEY = 'bgr_last_ranking_filters';

const VALID_SORTS = new Set<RankingSort>(['VALUE_SCORE', 'RATING', 'PLAYTIME', 'PRICE', 'TITLE', 'RELEASE_DATE']);
const VALID_DIRS = new Set<SortDirection>(['ASC', 'DESC']);

function numArray(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const n = v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return n.length === v.length ? n : undefined;
}

/** Restore full filter bar state (including scoring weights) after refresh; falls back to onboarding. */
function loadLastRankingFilters(): Filters | null {
  try {
    const raw = localStorage.getItem(LAST_RANKING_FILTERS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const f: Filters = { ...defaultFilters };
    if (typeof p.releaseYearMin === 'string') f.releaseYearMin = p.releaseYearMin;
    if (typeof p.releaseYearMax === 'string') f.releaseYearMax = p.releaseYearMax;
    if (typeof p.minPriceDollars === 'string') f.minPriceDollars = p.minPriceDollars;
    if (typeof p.maxPriceDollars === 'string') f.maxPriceDollars = p.maxPriceDollars;
    if (typeof p.minPlaytimeHours === 'string') f.minPlaytimeHours = p.minPlaytimeHours;
    if (typeof p.maxPlaytimeHours === 'string') f.maxPlaytimeHours = p.maxPlaytimeHours;
    if (typeof p.title === 'string') f.title = p.title;
    if (typeof p.ratingWeight === 'string') f.ratingWeight = p.ratingWeight;
    if (typeof p.playtimeWeight === 'string') f.playtimeWeight = p.playtimeWeight;
    if (typeof p.priceWeight === 'string') f.priceWeight = p.priceWeight;
    if (typeof p.includeFreeToPlay === 'boolean') f.includeFreeToPlay = p.includeFreeToPlay;
    if (typeof p.includeMultiplayerOnly === 'boolean') f.includeMultiplayerOnly = p.includeMultiplayerOnly;
    if (typeof p.excludeAdultRated === 'boolean') f.excludeAdultRated = p.excludeAdultRated;
    const pl = numArray(p.platformIds);
    if (pl) f.platformIds = pl;
    const g = numArray(p.genreIds);
    if (g) f.genreIds = g;
    if (typeof p.sort === 'string' && VALID_SORTS.has(p.sort as RankingSort)) f.sort = p.sort as RankingSort;
    if (typeof p.sortDir === 'string' && VALID_DIRS.has(p.sortDir as SortDirection)) f.sortDir = p.sortDir as SortDirection;
    return f;
  } catch {
    return null;
  }
}

function persistLastRankingFilters(filters: Filters): void {
  try {
    localStorage.setItem(LAST_RANKING_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* quota / private mode */
  }
}

const YEAR_PRESET_MAP: Record<OnboardingPrefs['yearPreset'], string> = {
  modern: '2015',
  classic: '2005',
  all: '',
};

function filtersFromOnboarding(prefs: OnboardingPrefs | null): Filters {
  if (!prefs) return defaultFilters;
  return {
    ...defaultFilters,
    platformIds: prefs.platformIds,
    releaseYearMin: YEAR_PRESET_MAP[prefs.yearPreset],
    includeFreeToPlay: prefs.includeFreeToPlay,
    includeMultiplayerOnly: prefs.includeMultiplayerOnly,
  };
}

/** Wizard updates: platforms, year preset, include flags — keeps weights, genres, price, title, etc. */
function mergeOnboardingIntoFilters(current: Filters, prefs: OnboardingPrefs): Filters {
  return {
    ...current,
    platformIds: [...prefs.platformIds],
    releaseYearMin: YEAR_PRESET_MAP[prefs.yearPreset],
    includeFreeToPlay: prefs.includeFreeToPlay,
    includeMultiplayerOnly: prefs.includeMultiplayerOnly,
  };
}

function safeInt(s: string): number | undefined {
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

function safeFloat(s: string): number | undefined {
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

/** Default save name from current filters (user can edit). */
function suggestConfigSaveName(filters: Filters): string {
  const parts: string[] = [];
  const yMin = filters.releaseYearMin.trim();
  const yMax = filters.releaseYearMax.trim();
  if (yMin || yMax) parts.push(`${yMin || '…'}–${yMax || '…'}`);
  if (filters.platformIds.length) parts.push(`${filters.platformIds.length} platform${filters.platformIds.length === 1 ? '' : 's'}`);
  if (filters.genreIds.length) parts.push(`${filters.genreIds.length} genre${filters.genreIds.length === 1 ? '' : 's'}`);
  const rw = safeFloat(filters.ratingWeight);
  const pw = safeFloat(filters.playtimeWeight);
  const prw = safeFloat(filters.priceWeight);
  if (rw !== undefined && pw !== undefined && prw !== undefined && (rw !== 1 || pw !== 1 || prw !== 1)) {
    parts.push(`weights ${rw}/${pw}/${prw}`);
  }
  const base = parts.length > 0 ? parts.join(' · ') : 'Ranking setup';
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${base} (${stamp})`;
}

function filtersToQuery(filters: Filters, offset: number): RankingQuery {
  const q: RankingQuery = { sort: filters.sort, sortDirection: filters.sortDir, offset, limit: PAGE_LIMIT };
  if (filters.platformIds.length) q.platformIds = filters.platformIds;
  if (filters.genreIds.length) q.genreIds = filters.genreIds;
  if (filters.releaseYearMin) q.releaseYearMin = safeInt(filters.releaseYearMin);
  if (filters.releaseYearMax) q.releaseYearMax = safeInt(filters.releaseYearMax);
  const minPrice = safeFloat(filters.minPriceDollars);
  if (minPrice !== undefined) q.minPriceCents = Math.round(minPrice * 100);
  const maxPrice = safeFloat(filters.maxPriceDollars);
  if (maxPrice !== undefined) q.maxPriceCents = Math.round(maxPrice * 100);
  if (filters.minPlaytimeHours) q.minPlaytimeHours = safeFloat(filters.minPlaytimeHours);
  if (filters.maxPlaytimeHours) q.maxPlaytimeHours = safeFloat(filters.maxPlaytimeHours);
  if (filters.title.trim()) q.title = filters.title.trim();
  const rW = safeFloat(filters.ratingWeight);
  if (rW !== undefined && rW !== 1) q.ratingWeight = rW;
  const pW = safeFloat(filters.playtimeWeight);
  if (pW !== undefined && pW !== 1) q.playtimeWeight = pW;
  const prW = safeFloat(filters.priceWeight);
  if (prW !== undefined && prW !== 1) q.priceWeight = prW;
  if (filters.includeFreeToPlay) q.includeFreeToPlay = true;
  if (filters.includeMultiplayerOnly) q.includeMultiplayerOnly = true;
  if (filters.excludeAdultRated) q.excludeAdultRated = true;
  return q;
}

function configToFilters(config: RankingConfig): Filters {
  return {
    platformIds: config.platformIds ?? [],
    genreIds: config.genreIds ?? [],
    releaseYearMin: config.releaseYearMin !== null ? String(config.releaseYearMin) : '',
    releaseYearMax: config.releaseYearMax !== null ? String(config.releaseYearMax) : '',
    minPriceDollars: config.minPriceCents !== null ? String(config.minPriceCents / 100) : '',
    maxPriceDollars: config.maxPriceCents !== null ? String(config.maxPriceCents / 100) : '',
    minPlaytimeHours: config.minPlaytimeHours !== null ? String(config.minPlaytimeHours) : '',
    maxPlaytimeHours: config.maxPlaytimeHours !== null ? String(config.maxPlaytimeHours) : '',
    title: '',
    ratingWeight: String(config.ratingWeight ?? 1),
    playtimeWeight: String(config.playtimeWeight ?? 1),
    priceWeight: String(config.priceWeight ?? 1),
    includeFreeToPlay: false,
    includeMultiplayerOnly: false,
    excludeAdultRated: config.excludeAdultRated === true,
    sort: 'VALUE_SCORE',
    sortDir: 'DESC',
  };
}

/** Block invalid ranges before the API; mirrors backend RankingService checks. */
function validateFilters(filters: Filters): string | null {
  const yrMin = filters.releaseYearMin === '' ? undefined : safeInt(filters.releaseYearMin);
  const yrMax = filters.releaseYearMax === '' ? undefined : safeInt(filters.releaseYearMax);
  if (yrMin !== undefined && yrMin < 0) {
    return 'Release year (from) cannot be negative.';
  }
  if (yrMax !== undefined && yrMax < 0) {
    return 'Release year (to) cannot be negative.';
  }
  if (yrMin !== undefined && yrMax !== undefined && yrMin > yrMax) {
    return 'Release year: “from” must be less than or equal to “to”.';
  }

  const minP = filters.minPriceDollars === '' ? undefined : safeFloat(filters.minPriceDollars);
  const maxP = filters.maxPriceDollars === '' ? undefined : safeFloat(filters.maxPriceDollars);
  if (minP !== undefined && minP < 0) {
    return 'Minimum price cannot be negative.';
  }
  if (maxP !== undefined && maxP < 0) {
    return 'Maximum price cannot be negative.';
  }
  if (minP !== undefined && maxP !== undefined && minP > maxP) {
    return 'Price: minimum must be less than or equal to maximum.';
  }

  const minH = filters.minPlaytimeHours === '' ? undefined : safeFloat(filters.minPlaytimeHours);
  const maxH = filters.maxPlaytimeHours === '' ? undefined : safeFloat(filters.maxPlaytimeHours);
  if (minH !== undefined && minH < 0) {
    return 'Minimum playtime cannot be negative.';
  }
  if (maxH !== undefined && maxH < 0) {
    return 'Maximum playtime cannot be negative.';
  }
  if (minH !== undefined && maxH !== undefined && minH > maxH) {
    return 'Playtime: minimum must be less than or equal to maximum.';
  }

  return null;
}

function filtersToConfigRequest(name: string, filters: Filters) {
  const req: {
    name: string;
    platformIds?: number[]; genreIds?: number[];
    releaseYearMin?: number; releaseYearMax?: number;
    minPriceCents?: number; maxPriceCents?: number;
    minPlaytimeHours?: number; maxPlaytimeHours?: number;
    ratingWeight?: number; playtimeWeight?: number; priceWeight?: number;
    excludeAdultRated?: boolean;
  } = { name };
  if (filters.platformIds.length) req.platformIds = filters.platformIds;
  if (filters.genreIds.length) req.genreIds = filters.genreIds;
  const yrMin = safeInt(filters.releaseYearMin);
  if (yrMin !== undefined) req.releaseYearMin = yrMin;
  const yrMax = safeInt(filters.releaseYearMax);
  if (yrMax !== undefined) req.releaseYearMax = yrMax;
  const minP = safeFloat(filters.minPriceDollars);
  if (minP !== undefined) req.minPriceCents = Math.round(minP * 100);
  const maxP = safeFloat(filters.maxPriceDollars);
  if (maxP !== undefined) req.maxPriceCents = Math.round(maxP * 100);
  const minH = safeFloat(filters.minPlaytimeHours);
  if (minH !== undefined) req.minPlaytimeHours = minH;
  const maxH = safeFloat(filters.maxPlaytimeHours);
  if (maxH !== undefined) req.maxPlaytimeHours = maxH;
  const rW = safeFloat(filters.ratingWeight);
  if (rW !== undefined && rW !== 1) req.ratingWeight = rW;
  const pW = safeFloat(filters.playtimeWeight);
  if (pW !== undefined && pW !== 1) req.playtimeWeight = pW;
  const prW = safeFloat(filters.priceWeight);
  if (prW !== undefined && prW !== 1) req.priceWeight = prW;
  if (filters.excludeAdultRated) req.excludeAdultRated = true;
  return req;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FILTER': {
      const filters = { ...state.filters, [action.field]: action.value };
      persistLastRankingFilters(filters);
      return {
        ...state,
        filters,
        error: null,
        validationError: null,
      };
    }
    case 'SET_TITLE': {
      const filters = { ...state.filters, title: action.value };
      persistLastRankingFilters(filters);
      return {
        ...state,
        filters,
        error: null,
        validationError: null,
      };
    }
    case 'SET_WEIGHT': {
      const filters = { ...state.filters, [action.field]: action.value };
      persistLastRankingFilters(filters);
      return {
        ...state,
        filters,
        error: null,
        validationError: null,
      };
    }
    case 'SET_INCLUDE': {
      const filters = { ...state.filters, [action.field]: action.value };
      persistLastRankingFilters(filters);
      return {
        ...state,
        filters,
        error: null,
        validationError: null,
      };
    }
    case 'SET_MULTI_FILTER': {
      const filters = { ...state.filters, [action.field]: action.ids };
      persistLastRankingFilters(filters);
      return {
        ...state,
        filters,
        error: null,
        validationError: null,
      };
    }
    case 'SET_SORT': {
      const newFilters = { ...state.filters, sort: action.sort, sortDir: action.dir };
      persistLastRankingFilters(newFilters);
      return {
        ...state,
        filters: newFilters,
        offset: 0,
        appliedQuery: filtersToQuery(newFilters, 0),
        validationError: null,
      };
    }
    case 'APPLY_FILTERS':
      return { ...state, offset: 0, appliedQuery: filtersToQuery(state.filters, 0) };
    case 'LOAD_CONFIG': {
      const filters = configToFilters(action.config);
      persistLastRankingFilters(filters);
      return {
        ...state,
        filters,
        offset: 0,
        appliedQuery: filtersToQuery(filters, 0),
        validationError: null,
      };
    }
    case 'SET_OFFSET':
      return { ...state, offset: action.offset, appliedQuery: filtersToQuery(state.filters, action.offset) };
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, data: action.data };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error, data: null };
    case 'SET_VALIDATION_ERROR':
      return { ...state, validationError: action.error };
    case 'APPLY_ONBOARDING': {
      const filters = mergeOnboardingIntoFilters(state.filters, action.prefs);
      persistLastRankingFilters(filters);
      return {
        ...state,
        filters,
        offset: 0,
        appliedQuery: filtersToQuery(filters, 0),
        validationError: null,
      };
    }
    default:
      return state;
  }
}

function buildInitialState(prefs: OnboardingPrefs | null): State {
  const filters = loadLastRankingFilters() ?? filtersFromOnboarding(prefs);
  return {
    filters,
    appliedQuery: filtersToQuery(filters, 0),
    offset: 0,
    data: null,
    loading: false,
    error: null,
    validationError: null,
  };
}

// --- Helpers ---

function formatPrice(cents: number | null): string {
  if (cents === null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatNumber(n: number | null, decimals = 1): string {
  if (n === null) return '—';
  return n.toFixed(decimals);
}

/** Short label for grid cards — keeps the stats row on one line (k/M for large scores). */
function formatValueScoreForCard(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}k`;
  if (a >= 100) return `${sign}${a.toFixed(1)}`;
  return v.toFixed(2);
}

/** IGDB platform id for Windows (PC). */
const IGDB_PLATFORM_PC_WINDOWS = 6;

/**
 * Tier estimates for Steam/PC rows are often misleading (e.g. $14.99 floor); show a visible flag.
 * Skips nominal free substitute ($1.00) and tracked CheapShark deals.
 */
function shouldWarnPcTierEstimate(result: RankingResult): boolean {
  if (result.priceIsTrackedDeal === true) return false;
  if (result.priceCents == null || result.priceCents <= 100) return false;
  const steamOrPc =
    result.steamAppId != null ||
    (result.platformIds?.includes(IGDB_PLATFORM_PC_WINDOWS) ?? false);
  return steamOrPc;
}

function PcTierEstimateBadge({ result }: { result: RankingResult }) {
  if (!shouldWarnPcTierEstimate(result)) return null;
  return (
    <span
      className="price-pc-est-badge"
      title="Tier estimate — often inaccurate for PC/Steam when no CheapShark deal is synced for this row."
      aria-label="Estimated price, not a tracked deal"
    >
      Est
    </span>
  );
}

/** Hover title on grid/table price: deal vs estimate. */
function priceSourceTitleForCard(result: RankingResult): string {
  if (result.priceCents == null || result.priceCents <= 0) return 'Price';
  if (result.priceIsTrackedDeal === true) {
    return 'Price — tracked PC deal (CheapShark)';
  }
  if (result.priceIsTrackedDeal === false) {
    return 'Price — estimated from platform tier (no tracked deal)';
  }
  return 'Price';
}

// --- Sub-components ---

function FilterBar({
  filters,
  platforms,
  genres,
  onFilterChange,
  onMultiFilterChange,
  onTitleChange,
  onTitlePick,
  onTitleClear,
  onWeightChange,
  onIncludeChange,
  onApply,
}: {
  filters: Filters;
  platforms: MetadataItem[] | null;
  genres: MetadataItem[] | null;
  onFilterChange: (field: FilterField, value: string) => void;
  onMultiFilterChange: (field: 'platformIds' | 'genreIds', ids: number[]) => void;
  onTitleChange: (value: string) => void;
  onTitlePick: (value: string) => void;
  onTitleClear: () => void;
  onWeightChange: (field: WeightField, value: string) => void;
  onIncludeChange: (field: IncludeField, value: boolean) => void;
  onApply: () => void;
}) {
  const searchHintId = useId();
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentList, setRecentList] = useState<string[]>(() => loadRecentSearches());
  const searchWrapRef = useRef<HTMLDivElement>(null);

  function field(label: string, key: FilterField, placeholder: string) {
    return (
      <div className="filter-field">
        <label htmlFor={`filter-${key}`}>{label}</label>
        <input
          id={`filter-${key}`}
          type="number"
          placeholder={placeholder}
          value={filters[key] as string}
          onChange={e => onFilterChange(key, e.target.value)}
        />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const q = filters.title.trim().toLowerCase();
  const suggestedRecent = recentList.filter(
    s => !q || s.toLowerCase().includes(q),
  ).slice(0, 8);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setRecentOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === RECENT_SEARCHES_KEY || e.key === null) {
        setRecentList(loadRecentSearches());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <form
      className="filter-bar"
      onSubmit={e => { e.preventDefault(); }}
      aria-label="Ranking filters"
    >
      <div className="filter-field filter-title-field" ref={searchWrapRef}>
        <label htmlFor="filter-title">Search</label>
        <div className="filter-title-row">
          <div className="filter-title-input-wrap">
            <input
              id="filter-title"
              type="text"
              autoComplete="off"
              aria-describedby={searchHintId}
              placeholder="Game title…"
              value={filters.title}
              onChange={e => onTitleChange(e.target.value)}
              onFocus={() => {
                setRecentList(loadRecentSearches());
                setRecentOpen(true);
              }}
              onBlur={() => {
                // allow mousedown on list option before close (handled via document listener)
              }}
            />
            {recentOpen && suggestedRecent.length > 0 && (
              <ul className="search-recent-list" aria-label="Recent searches">
                {suggestedRecent.map(s => (
                  <li key={s}>
                    <button
                      type="button"
                      className="search-recent-item"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        onTitlePick(s);
                        setRecentOpen(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {filters.title.length > 0 && (
            <button
              type="button"
              className="filter-title-clear"
              onClick={onTitleClear}
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
        <span id={searchHintId} className="filter-title-hint">
          Recent searches when focused; list narrows as you type. Applies after a short pause.
        </span>
      </div>
      <MultiSelect
        label="Platform"
        options={platforms}
        selected={filters.platformIds}
        onChange={ids => onMultiFilterChange('platformIds', ids)}
      />
      <MultiSelect
        label="Genre"
        options={genres}
        selected={filters.genreIds}
        onChange={ids => onMultiFilterChange('genreIds', ids)}
      />
      <div className="filter-group">
        <span className="filter-group-label">Release Year</span>
        <div className="filter-group-inputs filter-group-inputs-only">
          {field('From', 'releaseYearMin', '1980')}
          {field('To', 'releaseYearMax', String(currentYear))}
        </div>
      </div>
      <div className="filter-group">
        <span className="filter-group-label">Playtime (hrs)</span>
        <div className="filter-group-inputs filter-group-inputs-only">
          {field('Min', 'minPlaytimeHours', '0')}
          {field('Max', 'maxPlaytimeHours', '200')}
        </div>
      </div>
      <div className="filter-group">
        <span className="filter-group-label">Price ($)</span>
        <div className="filter-group-inputs filter-group-inputs-only">
          {field('Min', 'minPriceDollars', '0')}
          {field('Max', 'maxPriceDollars', '100')}
        </div>
      </div>
      <div className="filter-include-group">
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.includeFreeToPlay}
            onChange={e => onIncludeChange('includeFreeToPlay', e.target.checked)}
          />
          Include free-to-play
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.includeMultiplayerOnly}
            onChange={e => onIncludeChange('includeMultiplayerOnly', e.target.checked)}
          />
          Include multiplayer-only
        </label>
        <label className="filter-checkbox" title="Uses IGDB content rating text. Games with no rating still appear.">
          <input
            type="checkbox"
            checked={filters.excludeAdultRated}
            onChange={e => onIncludeChange('excludeAdultRated', e.target.checked)}
          />
          Hide Mature / 18+ labels
        </label>
      </div>
      <div className="filter-apply-wrap">
        <button type="button" className="filter-apply-btn" onClick={onApply}>
          Apply filters &amp; scoring
        </button>
        <span className="filter-apply-sub">Uses everything above, including Advanced Scoring weights</span>
      </div>
      <details className="scoring-advanced">
        <summary>Advanced Scoring</summary>
        <p className="scoring-advanced-hint">
          Weights are 0–2 (each raises rating, playtime, or price in the value formula). Use <strong>Apply filters &amp; scoring</strong> after changing weights to refetch.
        </p>
        <div className="scoring-sliders">
          <label className="scoring-slider">
            <span>Rating weight: {filters.ratingWeight}</span>
            <input type="range" min="0" max="2" step="0.1" value={filters.ratingWeight} onChange={e => onWeightChange('ratingWeight', e.target.value)} />
          </label>
          <label className="scoring-slider">
            <span>Playtime weight: {filters.playtimeWeight}</span>
            <input type="range" min="0" max="2" step="0.1" value={filters.playtimeWeight} onChange={e => onWeightChange('playtimeWeight', e.target.value)} />
          </label>
          <label className="scoring-slider">
            <span>Price weight: {filters.priceWeight}</span>
            <input type="range" min="0" max="2" step="0.1" value={filters.priceWeight} onChange={e => onWeightChange('priceWeight', e.target.value)} />
          </label>
        </div>
      </details>
    </form>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: RankingSort;
  currentSort: RankingSort;
  currentDir: SortDirection;
  onSort: (sort: RankingSort, dir: SortDirection) => void;
}) {
  const isActive = currentSort === sortKey;
  const nextDir: SortDirection = isActive
    ? currentDir === 'DESC' ? 'ASC' : 'DESC'
    : SORT_DEFAULT_DIR[sortKey];

  return (
    <th scope="col">
      <button
        className={`sort-header${isActive ? ' sort-active' : ''}`}
        onClick={() => onSort(sortKey, nextDir)}
        aria-sort={isActive ? (currentDir === 'DESC' ? 'descending' : 'ascending') : 'none'}
      >
        {label}
        <span className="sort-indicator" aria-hidden>
          {isActive ? (currentDir === 'DESC' ? '▼' : '▲') : '⇅'}
        </span>
      </button>
    </th>
  );
}

type ViewMode = 'grid' | 'table';

function ResultRow({
  result,
  rank,
  onHide,
  platformsCatalog,
  appliedPlatformIds,
  preferredPlatformOrder,
}: {
  result: RankingResult;
  rank: number;
  onHide: (igdbGameId: number) => void;
  platformsCatalog: MetadataItem[] | null;
  appliedPlatformIds: number[] | undefined;
  preferredPlatformOrder: number[];
}) {
  const platformEntries = buildPlatformScanEntries(
    result.platformIds,
    platformsCatalog,
    appliedPlatformIds,
    preferredPlatformOrder,
    result,
  );
  return (
    <tr>
      <td>{rank}</td>
      <td>
        {result.coverImageUrl &&
          (() => {
            const href = primaryCoverHref(result);
            return href ? (
              <a href={href} target="_blank" rel="noreferrer" aria-label={primaryCoverAriaLabel(result)}>
                <img src={result.coverImageUrl} alt="" width={40} height={53} loading="lazy" />
              </a>
            ) : (
              <img src={result.coverImageUrl} alt="" width={40} height={53} loading="lazy" />
            );
          })()}
      </td>
      <td>
        {(() => {
          const href = primaryCoverHref(result);
          return href ? (
            <a href={href} target="_blank" rel="noreferrer" aria-label={primaryCoverAriaLabel(result)}>
              {result.title}
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          ) : (
            result.title
          );
        })()}
      </td>
      <td className="col-content-rating" title="Content rating (IGDB)">
        {result.ageRatingDisplay?.trim() ? result.ageRatingDisplay : '—'}
      </td>
      <td className="col-platforms">
        <PlatformScanLine entries={platformEntries} result={result} />
      </td>
      <td>{formatNumber(result.igdbRating)}</td>
      <td>
        {result.hltbHours !== null ? (
          canLinkHltbSearch(result) ? (
            <a
              className="table-external-link"
              href={hltbSearchUrl(result.title)}
              target="_blank"
              rel="noreferrer"
              title="HowLongToBeat (opens in new tab)"
            >
              {formatNumber(result.hltbHours)} hrs
              <span className="sr-only"> — HowLongToBeat, opens in new tab</span>
            </a>
          ) : (
            `${formatNumber(result.hltbHours)} hrs`
          )
        ) : (
          '—'
        )}
      </td>
      <td className="table-price-with-badge">
        {(() => {
          const priceHover = priceSourceTitleForCard(result);
          const href = cardPriceHref(result);
          if (href) {
            return (
              <>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="table-external-link"
                  title={priceHover}
                >
                  {formatPrice(result.priceCents)}
                  <span className="sr-only"> — {cardPriceLinkLabel(result)}</span>
                </a>
                <PcTierEstimateBadge result={result} />
              </>
            );
          }
          return (
            <>
              <span title={priceHover}>{formatPrice(result.priceCents)}</span>
              <PcTierEstimateBadge result={result} />
            </>
          );
        })()}
      </td>
      <td>{formatNumber(result.valueScore, 2)}</td>
      <td>
        <button
          type="button"
          className="dismiss-game-btn"
          onClick={() => onHide(result.igdbGameId)}
          aria-label={`Hide ${result.title} from this list`}
        >
          No thanks
        </button>
      </td>
    </tr>
  );
}

function GameCardSkeleton() {
  return (
    <article className="game-card game-card-skeleton" aria-hidden>
      <div className="game-card-cover skeleton-shimmer" />
      <div className="game-card-body">
        <div className="skeleton-line skeleton-title-block skeleton-shimmer" />
        <div className="skeleton-line skeleton-meta-row skeleton-shimmer" />
        <div className="skeleton-stats skeleton-shimmer" />
      </div>
    </article>
  );
}

const GRID_SKELETON_COUNT = 16;
const TITLE_SEARCH_DEBOUNCE_MS = 300;

function RankingsTableSkeleton() {
  return (
    <div className="table-wrapper rankings-table-skeleton-wrap" aria-hidden>
      <table className="rankings-table rankings-table-skeleton">
        <thead>
          <tr>
            {Array.from({ length: 11 }, (_, i) => (
              <th key={i} scope="col"><span className="skeleton-line skeleton-th skeleton-shimmer" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: 11 }, (_, c) => (
                <td key={c}><span className="skeleton-line skeleton-td skeleton-shimmer" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameCard({
  result,
  rank,
  onHide,
  platformsCatalog,
  appliedPlatformIds,
  preferredPlatformOrder,
}: {
  result: RankingResult;
  rank: number;
  onHide: (igdbGameId: number) => void;
  platformsCatalog: MetadataItem[] | null;
  appliedPlatformIds: number[] | undefined;
  preferredPlatformOrder: number[];
}) {
  const coverInner = result.coverImageUrl ? (
    <img src={result.coverImageUrl} alt="" loading="lazy" />
  ) : (
    <div className="game-card-no-cover" />
  );
  const platformEntries = buildPlatformScanEntries(
    result.platformIds,
    platformsCatalog,
    appliedPlatformIds,
    preferredPlatformOrder,
    result,
  );
  const contentRating = result.ageRatingDisplay?.trim();

  return (
    <article className="game-card">
      <div className="game-card-cover">
        <span className="game-card-rank">#{rank}</span>
        <button
          type="button"
          className="game-card-dismiss-x"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onHide(result.igdbGameId);
          }}
          aria-label={`Hide ${result.title} from this list`}
        >
          <span aria-hidden>×</span>
        </button>
        {(() => {
          const href = primaryCoverHref(result);
          return href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="game-card-cover-link"
              aria-label={primaryCoverAriaLabel(result)}
            >
              {coverInner}
            </a>
          ) : (
            coverInner
          );
        })()}
      </div>
      <div className="game-card-body">
        <h3 className="game-card-title">
          {(() => {
            const href = primaryCoverHref(result);
            return href ? (
              <a href={href} target="_blank" rel="noreferrer" aria-label={primaryCoverAriaLabel(result)}>
                {result.title}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            ) : (
              result.title
            );
          })()}
        </h3>
        <div className="game-card-meta-row">
          <div className="game-card-meta-platforms">
            {platformEntries.length > 0 ? (
              <PlatformScanLine entries={platformEntries} result={result} />
            ) : (
              <span className="platform-scan-line">—</span>
            )}
          </div>
          <p
            className="game-card-meta-esrb"
            title={contentRating ? 'Content rating from IGDB' : undefined}
          >
            {contentRating ? contentRating : '—'}
          </p>
        </div>
        <div className="game-card-stats">
          <span
            className="game-card-stat-value"
            title={
              result.valueScore !== null
                ? `Value score ${result.valueScore} (rating × playtime ÷ price; weights may apply)`
                : 'Value score'
            }
          >
            <img
              src="/nextplay_favicon.svg"
              alt=""
              className="game-card-value-icon"
              width={12}
              height={12}
              decoding="async"
            />
            <span className="sr-only">Value score </span>
            <span className="game-card-stat-value-text">
              {formatValueScoreForCard(result.valueScore)}
            </span>
          </span>
          <span title="IGDB user rating">
            {(() => {
              const igdb = igdbPageUrl(result);
              return igdb ? (
                <a href={igdb} target="_blank" rel="noreferrer" className="game-card-stat-link">
                  ⭐ {formatNumber(result.igdbRating)}
                  <span className="sr-only"> — IGDB, opens in new tab</span>
                </a>
              ) : (
                <>⭐ {formatNumber(result.igdbRating)}</>
              );
            })()}
          </span>
          <span className="game-card-price-with-source">
            {(() => {
              const priceTitle = priceSourceTitleForCard(result);
              const priceLink = cardPriceHref(result);
              const priceLabel = formatPrice(result.priceCents);
              if (priceLink) {
                return (
                  <>
                    <a
                      href={priceLink}
                      target="_blank"
                      rel="noreferrer"
                      className="game-card-stat-link"
                      title={priceTitle}
                    >
                      {priceLabel}
                      <span className="sr-only"> — {cardPriceLinkLabel(result)}</span>
                    </a>
                    <PcTierEstimateBadge result={result} />
                  </>
                );
              }
              return (
                <>
                  <span title={priceTitle}>{priceLabel}</span>
                  <PcTierEstimateBadge result={result} />
                </>
              );
            })()}
          </span>
          <span
            title={
              canLinkHltbSearch(result)
                ? 'HowLongToBeat (opens in new tab)'
                : result.hltbHours !== null
                  ? 'Playtime (estimated when no HLTB match)'
                  : 'Playtime'
            }
          >
            {result.hltbHours !== null ? (
              canLinkHltbSearch(result) ? (
                <a
                  href={hltbSearchUrl(result.title)}
                  target="_blank"
                  rel="noreferrer"
                  className="game-card-stat-link"
                >
                  {formatNumber(result.hltbHours)}h
                  <span className="sr-only"> — HowLongToBeat, opens in new tab</span>
                </a>
              ) : (
                `${formatNumber(result.hltbHours)}h`
              )
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

function Pagination({
  offset,
  limit,
  total,
  onPage,
}: {
  offset: number;
  limit: number;
  total: number;
  onPage: (offset: number) => void;
}) {
  const page = Math.floor(offset / limit);
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        onClick={() => onPage(Math.max(0, offset - limit))}
        disabled={offset === 0}
        aria-label="Previous page"
      >
        Previous
      </button>
      <span>Page {page + 1} of {totalPages}</span>
      <button
        onClick={() => onPage(offset + limit)}
        disabled={offset + limit >= total}
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
}

// --- Page ---

export default function RankingsPage() {
  const { token, isLoggedIn } = useAuth();
  const { prefs } = useOnboarding();
  const [state, dispatch] = useReducer(reducer, prefs, buildInitialState);
  const { filters, appliedQuery, offset, data, loading, error, validationError } = state;

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [platforms, setPlatforms] = useState<MetadataItem[] | null>(null);
  const [genres, setGenres] = useState<MetadataItem[] | null>(null);
  const [hiddenIds, setHiddenIds] = useState(loadHiddenGameIds);

  useEffect(() => {
    void getPlatforms().then(setPlatforms).catch(() => setPlatforms([]));
    void getGenres().then(setGenres).catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HIDDEN_GAMES_KEY || e.key === null) setHiddenIds(loadHiddenGameIds());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const hideGame = useCallback((igdbGameId: number) => {
    setHiddenIds(prev => {
      if (prev.has(igdbGameId)) return prev;
      const next = new Set(prev);
      next.add(igdbGameId);
      saveHiddenGameIds(next);
      return next;
    });
  }, []);

  const clearHiddenGames = useCallback(() => {
    setHiddenIds(new Set());
    saveHiddenGameIds(new Set());
  }, []);

  const prefsRef = useRef(prefs);
  useEffect(() => {
    if (prefs && prefs !== prefsRef.current) {
      dispatch({ type: 'APPLY_ONBOARDING', prefs });
    }
    prefsRef.current = prefs;
  }, [prefs]);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const appliedQueryRef = useRef(appliedQuery);
  appliedQueryRef.current = appliedQuery;

  const titleDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitialTitleDebounceRef = useRef(true);
  const ignoreNextTitleDebounceRef = useRef(false);

  const clearTitleDebounceTimer = useCallback(() => {
    if (titleDebounceTimerRef.current !== null) {
      clearTimeout(titleDebounceTimerRef.current);
      titleDebounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    dispatch({ type: 'FETCH_START' });
    void getRankings(appliedQuery, ac.signal)
      .then(result => {
        dispatch({ type: 'FETCH_SUCCESS', data: result });
      })
      .catch(e => {
        if (ac.signal.aborted) return;
        const message =
          e instanceof ApiError ? e.message : 'Failed to load rankings.';
        dispatch({ type: 'FETCH_ERROR', error: message });
      });
    return () => ac.abort();
  }, [appliedQuery]);

  useEffect(() => {
    if (skipInitialTitleDebounceRef.current) {
      skipInitialTitleDebounceRef.current = false;
      return;
    }
    if (ignoreNextTitleDebounceRef.current) {
      ignoreNextTitleDebounceRef.current = false;
      return;
    }
    clearTitleDebounceTimer();
    titleDebounceTimerRef.current = setTimeout(() => {
      titleDebounceTimerRef.current = null;
      const f = filtersRef.current;
      const err = validateFilters(f);
      if (err) {
        dispatch({ type: 'SET_VALIDATION_ERROR', error: err });
        const lastTitle = appliedQueryRef.current.title ?? '';
        if (f.title !== lastTitle) {
          ignoreNextTitleDebounceRef.current = true;
          dispatch({ type: 'SET_TITLE', value: lastTitle });
        }
        return;
      }
      dispatch({ type: 'SET_VALIDATION_ERROR', error: null });
      dispatch({ type: 'APPLY_FILTERS' });
      const t = f.title.trim();
      if (t) pushRecentSearch(t);
    }, TITLE_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTitleDebounceTimer();
    };
  }, [filters.title, clearTitleDebounceTimer]);

  const handleTitlePick = useCallback(
    (s: string) => {
      clearTitleDebounceTimer();
      ignoreNextTitleDebounceRef.current = true;
      const f = { ...filtersRef.current, title: s };
      const err = validateFilters(f);
      if (err) {
        dispatch({ type: 'SET_VALIDATION_ERROR', error: err });
        dispatch({ type: 'SET_TITLE', value: appliedQueryRef.current.title ?? '' });
        return;
      }
      dispatch({ type: 'SET_VALIDATION_ERROR', error: null });
      dispatch({ type: 'SET_TITLE', value: s });
      dispatch({ type: 'APPLY_FILTERS' });
      pushRecentSearch(s);
    },
    [clearTitleDebounceTimer, dispatch],
  );

  const handleTitleClear = useCallback(() => {
    clearTitleDebounceTimer();
    ignoreNextTitleDebounceRef.current = true;
    const f = { ...filtersRef.current, title: '' };
    const err = validateFilters(f);
    if (err) {
      dispatch({ type: 'SET_VALIDATION_ERROR', error: err });
      dispatch({ type: 'SET_TITLE', value: appliedQueryRef.current.title ?? '' });
      return;
    }
    dispatch({ type: 'SET_VALIDATION_ERROR', error: null });
    dispatch({ type: 'SET_TITLE', value: '' });
    dispatch({ type: 'APPLY_FILTERS' });
  }, [clearTitleDebounceTimer, dispatch]);

  async function handleSaveConfig(name: string) {
    if (!token) return;
    await createConfig(filtersToConfigRequest(name, filters), token);
  }

  return (
    <div className="rankings-page">
      <h1>Value Rankings</h1>
      <p className="rankings-subtitle">Ranked by value: rating × playtime ÷ price.</p>
      <p className="rankings-price-note">
        <strong className="price-pc-est-badge price-pc-est-badge--inline">Est</strong> on a price means a{' '}
        <strong>tier estimate</strong> (often rough on PC/Steam when no CheapShark deal is synced).{' '}
        <strong>Deal</strong> in the price hover means a tracked sale. Full cache refresh runs{' '}
        <strong>nightly</strong> (default 03:00 server time) and when an admin triggers sync.
      </p>

      <section className="about-section" aria-label="How rankings work">
        <details>
          <summary>How does the value score work?</summary>
          <div className="about-body">
            <p>
              Each game is scored using: <strong>(IGDB rating × hours to beat) ÷ price</strong>.
              A game that costs $10, takes 50 hours, and scores 90 on IGDB ranks higher than a $60
              game that takes 8 hours and scores 95 — because you get more per dollar.
            </p>
            <p>
              <strong>Grid cards:</strong> the small site icon marks this app&apos;s <strong>value score</strong>;
              ⭐ is the IGDB user rating (link only when we have an IGDB game URL); with a <strong>Steam app id</strong>, the price opens <a href="https://www.cheapshark.com" target="_blank" rel="noreferrer">CheapShark</a>&apos;s search for that game; without a Steam id but with a synced deal link, the price uses that redirect; otherwise the price may not be clickable. <strong>Hover the price</strong> (grid or table) to see whether that dollar amount is a tracked PC deal or a tier estimate. Hours link to HowLongToBeat only when playtime came from an HLTB match (otherwise the number is plain text). Platform names link to storefronts when we can infer them. Content rating (ESRB, etc.) appears on the right when IGDB lists one.
            </p>
            <p>
              Playtime comes from <a href="https://howlongtobeat.com" target="_blank" rel="noreferrer">HowLongToBeat</a>.
              If no playtime data exists, the genre average is used.
              <strong>Deal</strong> vs <strong>Est.</strong> is the important split: <strong>Deal</strong> is a current tracked PC price from <a href="https://www.cheapshark.com" target="_blank" rel="noreferrer">CheapShark</a>; <strong>Est.</strong> is a tier-based estimate when there&apos;s no deal—treat estimates as more uncertain for &quot;what would I really pay?&quot; On PC/Steam rows, a small <strong>Est</strong> badge appears next to the price when it&apos;s still an estimate. Hover the price to see which applies.
              <strong> Comparing non-PC games:</strong> either way, the dollar stays PC/Steam–oriented, so it often won&apos;t match PlayStation, Xbox, or Nintendo store pricing—rankings between console titles can be misleading.
              Ratings come from <a href="https://www.igdb.com" target="_blank" rel="noreferrer">IGDB</a>.
              <strong> Content</strong> (ESRB, PEGI, etc.) is also from IGDB when available — not every game has a rating listed.
              Use <strong>Hide Mature / 18+ labels</strong> to drop games whose IGDB label looks adult-rated; unrated games stay in the list.
              Data refreshes nightly.
            </p>
            <p className="about-exclusions">
              Excluded: free/freemium games, multiplayer-only titles, games with fewer than 10 ratings, games with no price data.
            </p>
          </div>
        </details>
      </section>

      {isLoggedIn && token && (
        <SavedConfigs
          token={token}
          platforms={platforms}
          genres={genres}
          suggestedSaveName={suggestConfigSaveName(filters)}
          onLoad={config => dispatch({ type: 'LOAD_CONFIG', config })}
          onSave={handleSaveConfig}
        />
      )}

      <FilterBar
        filters={filters}
        platforms={platforms}
        genres={genres}
        onFilterChange={(field, value) => dispatch({ type: 'SET_FILTER', field, value })}
        onMultiFilterChange={(field, ids) => dispatch({ type: 'SET_MULTI_FILTER', field, ids })}
        onTitleChange={value => dispatch({ type: 'SET_TITLE', value })}
        onTitlePick={handleTitlePick}
        onTitleClear={handleTitleClear}
        onWeightChange={(field, value) => dispatch({ type: 'SET_WEIGHT', field, value })}
        onIncludeChange={(field, value) => dispatch({ type: 'SET_INCLUDE', field, value })}
        onApply={() => {
          clearTitleDebounceTimer();
          const err = validateFilters(filters);
          if (err) {
            dispatch({ type: 'SET_VALIDATION_ERROR', error: err });
            return;
          }
          dispatch({ type: 'SET_VALIDATION_ERROR', error: null });
          dispatch({ type: 'APPLY_FILTERS' });
        }}
      />

      {error && <p className="status-message error" role="alert">{error}</p>}
      {validationError && (
        <p className="status-message error" role="alert">{validationError}</p>
      )}

      {(data || loading) && !error && (
        <>
          <div className="results-toolbar">
            <div className="result-count-stack">
              <p className="result-count" aria-live="polite">
                {data ? (
                  <>
                    {data.total} games
                    {' · '}
                    <span className="hidden-count">{hiddenIds.size} hidden</span>
                    <button
                      type="button"
                      className="clear-hidden-btn"
                      disabled={hiddenIds.size === 0}
                      onClick={clearHiddenGames}
                    >
                      Show hidden
                    </button>
                  </>
                ) : (
                  '…'
                )}
              </p>
              <div className="result-count-subrow" aria-live="polite">
                {!loading && data && (() => {
                  const hiddenHere = data.results.filter(r => hiddenIds.has(r.igdbGameId)).length;
                  const shownHere = data.results.length - hiddenHere;
                  if (hiddenHere === 0 || shownHere === 0) return null;
                  return (
                    <span className="hidden-page-hint">
                      {hiddenHere} hidden on this page ({shownHere} shown)
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="view-toggle" role="radiogroup" aria-label="View mode">
              <button
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                title="Grid view"
              >▦</button>
              <button
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
                title="Table view"
              >☰</button>
            </div>
          </div>

          {loading && (
            viewMode === 'grid' ? (
              <div className="game-grid">
                {Array.from({ length: GRID_SKELETON_COUNT }, (_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <RankingsTableSkeleton />
            )
          )}

          {!loading && data && (() => {
            const visibleRows = data.results
              .map((result, i) => ({ result, rank: offset + i + 1 }))
              .filter(({ result }) => !hiddenIds.has(result.igdbGameId));
            const hiddenOnPage = data.results.length - visibleRows.length;

            return (
              <>
                {visibleRows.length === 0 && data.results.length > 0 && (
                  <p className="status-message" role="status">
                    Every game on this page is hidden ({hiddenOnPage}).
                    {' '}
                    <button type="button" className="clear-hidden-btn" onClick={clearHiddenGames}>
                      Show all hidden games
                    </button>
                    {' '}
                    or use the next page.
                  </p>
                )}
                {viewMode === 'grid' ? (
                  <div className="game-grid">
                    {visibleRows.map(({ result, rank }) => (
                      <GameCard
                        key={result.igdbGameId}
                        result={result}
                        rank={rank}
                        onHide={hideGame}
                        platformsCatalog={platforms}
                        appliedPlatformIds={appliedQuery.platformIds}
                        preferredPlatformOrder={prefs?.platformIds ?? []}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="rankings-table">
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Cover</th>
                          <SortableHeader label="Title" sortKey="TITLE" currentSort={filters.sort} currentDir={filters.sortDir} onSort={(s, d) => dispatch({ type: 'SET_SORT', sort: s, dir: d })} />
                          <th scope="col" className="col-content-rating" title="ESRB, PEGI, or other board (from IGDB)">Content</th>
                          <th scope="col" className="col-platforms">Platforms</th>
                          <SortableHeader label="Rating" sortKey="RATING" currentSort={filters.sort} currentDir={filters.sortDir} onSort={(s, d) => dispatch({ type: 'SET_SORT', sort: s, dir: d })} />
                          <SortableHeader label="Playtime" sortKey="PLAYTIME" currentSort={filters.sort} currentDir={filters.sortDir} onSort={(s, d) => dispatch({ type: 'SET_SORT', sort: s, dir: d })} />
                          <SortableHeader label="Price" sortKey="PRICE" currentSort={filters.sort} currentDir={filters.sortDir} onSort={(s, d) => dispatch({ type: 'SET_SORT', sort: s, dir: d })} />
                          <SortableHeader label="Value Score" sortKey="VALUE_SCORE" currentSort={filters.sort} currentDir={filters.sortDir} onSort={(s, d) => dispatch({ type: 'SET_SORT', sort: s, dir: d })} />
                          <th scope="col" className="col-actions"><span className="sr-only">Hide</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map(({ result, rank }) => (
                          <ResultRow
                            key={result.igdbGameId}
                            result={result}
                            rank={rank}
                            onHide={hideGame}
                            platformsCatalog={platforms}
                            appliedPlatformIds={appliedQuery.platformIds}
                            preferredPlatformOrder={prefs?.platformIds ?? []}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}

          {!loading && data && (
            <Pagination
              offset={offset}
              limit={PAGE_LIMIT}
              total={data.total}
              onPage={newOffset => dispatch({ type: 'SET_OFFSET', offset: newOffset })}
            />
          )}
        </>
      )}
    </div>
  );
}
