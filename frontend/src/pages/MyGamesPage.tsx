import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getUserGames, importSteamFamilyLibrary } from '../api/userGames';
import { useAuth } from '../context/AuthContext';
import type { SteamFamilyImportResult, UserGamePage, UserGameSort } from '../types';
import './MyGamesPage.css';

const PAGE_LIMIT = 50;
type ImportPhase = 'importing' | 'refreshing' | null;

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

function sourceLabel(source: string): string {
  if (source === 'own') return 'Owned';
  if (source === 'family') return 'Family shared';
  return source;
}

export default function MyGamesPage() {
  const { token, isLoggedIn } = useAuth();
  const [data, setData] = useState<UserGamePage | null>(null);
  const [title, setTitle] = useState('');
  const [played, setPlayed] = useState('all');
  const [source, setSource] = useState('');
  const [genreId, setGenreId] = useState('');
  const [sort, setSort] = useState<UserGameSort>('TITLE');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importPhase, setImportPhase] = useState<ImportPhase>(null);
  const [importElapsedSeconds, setImportElapsedSeconds] = useState(0);
  const [importResult, setImportResult] = useState<SteamFamilyImportResult | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const importControllerRef = useRef<AbortController | null>(null);

  const request = useMemo(() => ({
    playable: true,
    played: played === 'all' ? undefined : played === 'played',
    source: source || undefined,
    genreIds: genreId ? [Number(genreId)] : undefined,
    title,
    sort,
    sortDirection,
    offset,
    limit: PAGE_LIMIT,
  }), [title, played, source, genreId, sort, sortDirection, offset]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void getUserGames(request, token, controller.signal)
      .then(result => {
        setData(result);
        setImportPhase(current => current === 'refreshing' ? null : current);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setError(error instanceof ApiError ? error.message : 'Failed to load your games.');
        setImportPhase(current => current === 'refreshing' ? null : current);
      });
    return () => controller.abort();
  }, [token, request, refreshNonce]);

  useEffect(() => {
    if (importPhase !== 'importing') return;
    const interval = window.setInterval(() => setImportElapsedSeconds(seconds => seconds + 1), 1_000);
    return () => window.clearInterval(interval);
  }, [importPhase]);

  const loading = data === null && error === null;

  function resetForNewQuery() {
    setData(null);
    setError(null);
    setOffset(0);
  }

  function changeSort(nextSort: UserGameSort) {
    if (sort === nextSort) {
      setSortDirection(current => current === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSort(nextSort);
      setSortDirection(nextSort === 'TITLE' ? 'ASC' : 'DESC');
    }
    resetForNewQuery();
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !token) return;
    setImportPhase('importing');
    setImportElapsedSeconds(0);
    setError(null);
    setImportResult(null);
    const controller = new AbortController();
    importControllerRef.current = controller;
    try {
      const result = await importSteamFamilyLibrary(file, token, controller.signal);
      setImportResult(result);
      resetForNewQuery();
      setImportPhase('refreshing');
      setRefreshNonce(current => current + 1);
    } catch (error) {
      setError(controller.signal.aborted
        ? 'Import cancelled. Refresh your library to see whether the server completed it before cancellation.'
        : error instanceof ApiError ? error.message : 'Failed to import the Steam Family CSV.');
      setImportPhase(null);
    } finally {
      importControllerRef.current = null;
    }
  }

  function cancelImport() {
    importControllerRef.current?.abort();
  }

  if (!isLoggedIn) {
    return (
      <div className="my-games-page my-games-auth">
        <h1>My Games</h1>
        <p><Link to="/login">Log in</Link> to view and import your library.</p>
      </div>
    );
  }

  const genreNames = new Map(data?.availableGenres.map(genre => [genre.id, genre.name]));
  const pageStart = data && data.total > 0 ? data.offset + 1 : 0;
  const pageEnd = data ? Math.min(data.offset + data.results.length, data.total) : 0;
  const hasActiveFilters = title.trim().length > 0 || played !== 'all' || source !== '' || genreId !== '';
  const showCovers = data?.results.some(game => game.coverImageUrl !== null) ?? false;
  const showGenres = data?.results.some(game => game.genreIds.length > 0) ?? false;
  const showRatings = data?.results.some(game => game.igdbRating !== null) ?? false;
  const importActive = importPhase !== null;
  const importTakingLong = importPhase === 'importing' && importElapsedSeconds >= 60;

  return (
    <div className="my-games-page">
      <div className="my-games-heading">
        <div>
          <h1>My Games</h1>
          <p>Playable games in your Steam library.</p>
        </div>
      </div>

      <section className="library-import-band" aria-label="Steam Family library import">
        <div className="library-import-copy">
          <strong>Steam Family library</strong>
          <span>Import a new export or refresh an existing library.</span>
        </div>
        <form className="library-import" onSubmit={handleImport}>
          <input id="steam-family-csv" className="library-file-input" type="file" accept=".csv,text/csv" disabled={importActive} onChange={event => setFile(event.target.files?.[0] ?? null)} />
          <label className="library-file-button" htmlFor="steam-family-csv">
            Choose CSV
          </label>
          <span className="library-file-name">{file?.name ?? 'No file selected'}</span>
          <button type="submit" disabled={!file || importActive}>{importActive ? 'Working...' : 'Import CSV'}</button>
        </form>
      </section>

      {importPhase && (
        <section className="library-import-progress" aria-live="polite" role="status">
          <div>
            <strong>{importPhase === 'importing' ? 'Importing Steam Family library' : 'Refreshing your library'}</strong>
            <span>{importPhase === 'importing'
              ? importTakingLong ? 'Still importing. Keep this page open while the library is matched.' : 'Uploading the CSV and matching game metadata.'
              : 'Loading the imported games into this view.'}</span>
          </div>
          <div className="library-progress-track" aria-hidden="true"><span /></div>
          {importPhase === 'importing' && <button className="library-import-cancel" type="button" onClick={cancelImport}>Cancel</button>}
        </section>
      )}

      {importResult && (
        <p className="import-result" role="status">
          Imported {importResult.totalRows} games: {importResult.created} new, {importResult.updated} updated.{' '}
          {importResult.cacheMatched > 0
            ? `${importResult.cacheMatched} matched to cached game metadata.`
            : 'No games matched to cached metadata yet.'}
        </p>
      )}

      {data && (data.total > 0 || hasActiveFilters) && (
        <section className="library-filters" aria-label="Library filters">
          <label className="library-search">
            <span>Search</span>
            <input value={title} onChange={event => { setTitle(event.target.value); resetForNewQuery(); }} placeholder="Search titles" />
          </label>
          <label>
            <span>Played</span>
            <select value={played} onChange={event => { setPlayed(event.target.value); resetForNewQuery(); }}>
              <option value="all">All games</option>
              <option value="unplayed">Unplayed</option>
              <option value="played">Played</option>
            </select>
          </label>
          <label>
            <span>Access</span>
            <select value={source} onChange={event => { setSource(event.target.value); resetForNewQuery(); }}>
              <option value="">All access</option>
              <option value="own">Owned</option>
              <option value="family">Family shared</option>
            </select>
          </label>
          {data.availableGenres.length > 0 && <label>
            <span>Genre</span>
            <select value={genreId} onChange={event => { setGenreId(event.target.value); resetForNewQuery(); }}>
              <option value="">All genres</option>
              {data.availableGenres.map(genre => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
            </select>
          </label>}
        </section>
      )}

      {error && <p className="library-status error" role="alert">{error}</p>}
      {loading && <p className="library-status">Loading library...</p>}

      {!loading && data && (
        <>
          {data.total > 0 && <div className="library-toolbar">
            <p>{data.total} playable games</p>
            <p>{pageStart}-{pageEnd} shown</p>
          </div>}
          {data.total === 0 ? (
            <section className="library-empty" aria-live="polite">
              <h2>{hasActiveFilters ? 'No games match these filters.' : 'Your playable library is ready for an import.'}</h2>
              <p>{hasActiveFilters ? 'Try clearing a filter or searching for a different title.' : 'Choose your Steam Family CSV above to add the games you can play.'}</p>
            </section>
          ) : (
            <div className="library-table-wrap">
              <table className="library-table">
                <thead>
                  <tr>
                    {showCovers && <th scope="col">Cover</th>}
                    <th scope="col"><button type="button" onClick={() => changeSort('TITLE')}>Title {sort === 'TITLE' && (sortDirection === 'ASC' ? '↑' : '↓')}</button></th>
                    <th scope="col">Access</th>
                    <th scope="col"><button type="button" onClick={() => changeSort('PLAYTIME')}>Playtime {sort === 'PLAYTIME' && (sortDirection === 'ASC' ? '↑' : '↓')}</button></th>
                    <th scope="col"><button type="button" onClick={() => changeSort('LAST_PLAYED')}>Last played {sort === 'LAST_PLAYED' && (sortDirection === 'ASC' ? '↑' : '↓')}</button></th>
                    {showGenres && <th scope="col">Genres</th>}
                    {showRatings && <th scope="col">Rating</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.results.map(game => (
                    <tr key={game.steamAppId}>
                      {showCovers && <td className="library-cover-cell">
                        {game.coverImageUrl ? <img src={game.coverImageUrl} alt="" /> : <span className="library-no-cover" aria-hidden="true" />}
                      </td>}
                      <td><a href={`https://store.steampowered.com/app/${game.steamAppId}`} target="_blank" rel="noreferrer">{game.title}</a></td>
                      <td><span className={`source-badge source-badge--${game.source}`}>{sourceLabel(game.source)}</span></td>
                      <td>{formatPlaytime(game.playtimeMinutes)}</td>
                      <td>{game.lastPlayedAt ?? 'Never'}</td>
                      {showGenres && <td className="library-genres">{game.genreIds.map(id => genreNames.get(id)).filter(Boolean).join(', ') || '—'}</td>}
                      {showRatings && <td>{game.igdbRating == null ? '—' : game.igdbRating.toFixed(0)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.total > PAGE_LIMIT && (
            <nav className="library-pagination" aria-label="Library pagination">
              <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}>Previous</button>
              <button type="button" disabled={offset + PAGE_LIMIT >= data.total} onClick={() => setOffset(offset + PAGE_LIMIT)}>Next</button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
