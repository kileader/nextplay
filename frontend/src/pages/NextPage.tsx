import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getNextPlayPicks } from '../api/nextPlay';
import { getUserGames } from '../api/userGames';
import { useAuth } from '../context/AuthContext';
import type { MetadataItem, NextPlayEnergy, NextPlayPick, NextPlaySessionLength } from '../types';
import './NextPage.css';

const SESSION_LENGTHS: Array<{ value: NextPlaySessionLength; label: string; detail: string }> = [
  { value: 'SHORT', label: 'A little time', detail: 'Shorter game' },
  { value: 'STANDARD', label: 'A solid session', detail: 'Balanced commitment' },
  { value: 'OPEN_ENDED', label: 'No rush', detail: 'Longer game is fine' },
];

const ENERGY_LEVELS: Array<{ value: NextPlayEnergy; label: string; detail: string }> = [
  { value: 'LOW', label: 'Low energy', detail: 'Keep it lighter' },
  { value: 'MEDIUM', label: 'Some energy', detail: 'A steady fit' },
  { value: 'HIGH', label: 'Ready to dive in', detail: 'More involved is fine' },
];

function formatHours(hours: number | null): string | null {
  if (hours == null) return null;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
}

export default function NextPage() {
  const { token, isLoggedIn } = useAuth();
  const [sessionLength, setSessionLength] = useState<NextPlaySessionLength>('STANDARD');
  const [energy, setEnergy] = useState<NextPlayEnergy>('MEDIUM');
  const [genreId, setGenreId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [availableGenres, setAvailableGenres] = useState<MetadataItem[]>([]);
  const [picks, setPicks] = useState<NextPlayPick[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setError(null);
    setPicks(null);
    void getNextPlayPicks({
      sessionLength,
      energy,
      genreIds: genreId ? [Number(genreId)] : undefined,
      refreshKey,
    }, token)
      .then(result => { if (active) setPicks(result); })
      .catch(requestError => {
        if (!active) return;
        setError(requestError instanceof ApiError ? requestError.message : 'Could not find picks right now.');
      });
    return () => { active = false; };
  }, [token, sessionLength, energy, genreId, refreshKey]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void getUserGames({ playable: true, offset: 0, limit: 1 }, token)
      .then(result => {
        if (active) setAvailableGenres(result.availableGenres);
      })
      .catch(() => {
        if (active) setAvailableGenres([]);
      });
    return () => { active = false; };
  }, [token]);

  function chooseSessionLength(value: NextPlaySessionLength) {
    setSessionLength(value);
    setRefreshKey(0);
  }

  function chooseEnergy(value: NextPlayEnergy) {
    setEnergy(value);
    setRefreshKey(0);
  }

  function chooseGenre(value: string) {
    setGenreId(value);
    setRefreshKey(0);
  }

  function refreshPicks() {
    setRefreshKey(key => key + 1);
  }

  function surpriseMe() {
    const session = SESSION_LENGTHS[Math.floor(Math.random() * SESSION_LENGTHS.length)];
    const energyLevel = ENERGY_LEVELS[Math.floor(Math.random() * ENERGY_LEVELS.length)];
    const genreChoices = ['', ...availableGenres.map(genre => String(genre.id))];
    const genre = genreChoices[Math.floor(Math.random() * genreChoices.length)] ?? '';
    setSessionLength(session.value);
    setEnergy(energyLevel.value);
    setGenreId(genre);
    setRefreshKey(key => key + 1);
  }

  if (!isLoggedIn) {
    return (
      <div className="next-page next-auth">
        <h1>Next</h1>
        <p><Link to="/login">Log in</Link> to choose from your games.</p>
      </div>
    );
  }

  return (
    <div className="next-page">
      <header className="next-heading">
        <p className="next-kicker">What fits now?</p>
        <h1>Next</h1>
      </header>

      <section className="next-prompts" aria-label="Pick what fits now">
        <fieldset>
          <legend>How much time do you have?</legend>
          <div className="next-choice-group">
            {SESSION_LENGTHS.map(option => (
              <button
                key={option.value}
                type="button"
                className={sessionLength === option.value ? 'next-choice is-selected' : 'next-choice'}
                aria-pressed={sessionLength === option.value}
                onClick={() => chooseSessionLength(option.value)}
              >
                <span>{option.label}</span>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>What is your energy level?</legend>
          <div className="next-choice-group">
            {ENERGY_LEVELS.map(option => (
              <button
                key={option.value}
                type="button"
                className={energy === option.value ? 'next-choice is-selected' : 'next-choice'}
                aria-pressed={energy === option.value}
                onClick={() => chooseEnergy(option.value)}
              >
                <span>{option.label}</span>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="next-tools" aria-label="Fine tune picks">
        <label>
          <span>Genre</span>
          <select value={genreId} onChange={event => chooseGenre(event.target.value)}>
            <option value="">Anything in my library</option>
            {availableGenres.map(genre => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
          </select>
        </label>
        <div className="next-tool-actions">
          <button type="button" onClick={refreshPicks}>Refresh</button>
          <button type="button" className="next-secondary-action" onClick={surpriseMe}>Surprise me</button>
        </div>
      </section>

      <section className="next-results" aria-live="polite">
        <div className="next-results-heading">
          <h2>Your picks</h2>
          {picks && <span>{picks.length} to consider</span>}
        </div>

        {error && <p className="next-message next-error" role="alert">{error}</p>}
        {!error && picks === null && <p className="next-message">Finding a few good fits...</p>}
        {!error && picks?.length === 0 && (
          <div className="next-empty">
            <h2>Nothing is available yet.</h2>
            <p>Import a Steam Family CSV in <Link to="/my-games">My Games</Link> to get picks.</p>
          </div>
        )}
        {picks && picks.length > 0 && (
          <div className="next-pick-grid">
            {picks.map((pick, index) => (
              <article className="next-pick" key={pick.steamAppId}>
                <div className="next-cover">
                  {pick.coverImageUrl
                    ? <img src={pick.coverImageUrl} alt={`Cover art for ${pick.title}`} />
                    : <span aria-hidden="true">{pick.title.slice(0, 1)}</span>}
                  <span className="next-pick-number">0{index + 1}</span>
                </div>
                <div className="next-pick-content">
                  <div className="next-pick-title-row">
                    <h3>{pick.title}</h3>
                    {formatHours(pick.hltbHours) && <span>{formatHours(pick.hltbHours)}</span>}
                  </div>
                  <p className="next-description">{pick.description ?? 'Description will appear when game metadata is available.'}</p>
                  <ul className="next-reasons">
                    {pick.reasons.map(reason => <li key={reason}>{reason}</li>)}
                  </ul>
                  <a href={`https://store.steampowered.com/app/${pick.steamAppId}`} target="_blank" rel="noreferrer">View game</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
