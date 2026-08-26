import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getUserGames, importSteamFamilyLibrary } from '../api/userGames';
import { useAuth } from '../context/AuthContext';
import type { SteamFamilyImportResult, UserGamePage, UserGameSort } from '../types';
import './MyGamesPage.css';

const PAGE_LIMIT = 50;

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
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SteamFamilyImportResult | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

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
      .then(setData)
      .catch(error => {
        if (controller.signal.aborted) return;
        setError(error instanceof ApiError ? error.message : 'Failed to load your games.');
      });
    return () => controller.abort();
  }, [token, request, refreshNonce]);

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
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await importSteamFamilyLibrary(file, token);
      setImportResult(result);
      resetForNewQuery();
      setRefreshNonce(current => current + 1);
    } catch (error) {
      setError(error instanceof ApiError ? error.message : 'Failed to import the Steam Family CSV.');
    } finally {
      setImporting(false);
    }
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

  return (
    <div className="my-games-page">
      <div className="my-games-heading">
        <div>
          <h1>My Games</h1>
          <p>Playable games in your Steam library.</p>
        </div>
        <form className="library-import" onSubmit={handleImport}>
          <label>
            <span className="sr-only">Steam Family CSV</span>
            <input type="file" accept=".csv,text/csv" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" disabled={!file || importing}>{importing ? 'Importing...' : 'Import CSV'}</button>
        </form>
      </div>

      {importResult && (
        <p className="import-result" role="status">
          Imported {importResult.totalRows} games: {importResult.created} new, {importResult.updated} updated.
        </p>
      )}

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
        <label>
          <span>Genre</span>
          <select value={genreId} onChange={event => { setGenreId(event.target.value); resetForNewQuery(); }}>
            <option value="">All genres</option>
            {data?.availableGenres.map(genre => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
          </select>
        </label>
      </section>

      {error && <p className="library-status error" role="alert">{error}</p>}
      {loading && <p className="library-status">Loading library...</p>}

      {!loading && data && (
        <>
          <div className="library-toolbar">
            <p>{data.total} playable games</p>
            {data.total > 0 && <p>{pageStart}-{pageEnd} shown</p>}
          </div>
          {data.total === 0 ? (
            <p className="library-empty">No playable games match these filters.</p>
          ) : (
            <div className="library-table-wrap">
              <table className="library-table">
                <thead>
                  <tr>
                    <th scope="col">Cover</th>
                    <th scope="col"><button type="button" onClick={() => changeSort('TITLE')}>Title {sort === 'TITLE' && (sortDirection === 'ASC' ? '↑' : '↓')}</button></th>
                    <th scope="col">Access</th>
                    <th scope="col"><button type="button" onClick={() => changeSort('PLAYTIME')}>Playtime {sort === 'PLAYTIME' && (sortDirection === 'ASC' ? '↑' : '↓')}</button></th>
                    <th scope="col"><button type="button" onClick={() => changeSort('LAST_PLAYED')}>Last played {sort === 'LAST_PLAYED' && (sortDirection === 'ASC' ? '↑' : '↓')}</button></th>
                    <th scope="col">Genres</th>
                    <th scope="col">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map(game => (
                    <tr key={game.steamAppId}>
                      <td className="library-cover-cell">
                        {game.coverImageUrl ? <img src={game.coverImageUrl} alt="" /> : <span className="library-no-cover" aria-hidden="true" />}
                      </td>
                      <td><a href={`https://store.steampowered.com/app/${game.steamAppId}`} target="_blank" rel="noreferrer">{game.title}</a></td>
                      <td><span className={`source-badge source-badge--${game.source}`}>{sourceLabel(game.source)}</span></td>
                      <td>{formatPlaytime(game.playtimeMinutes)}</td>
                      <td>{game.lastPlayedAt ?? 'Never'}</td>
                      <td className="library-genres">{game.genreIds.map(id => genreNames.get(id)).filter(Boolean).join(', ') || '—'}</td>
                      <td>{game.igdbRating == null ? '—' : game.igdbRating.toFixed(0)}</td>
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
