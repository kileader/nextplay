# NextPlay

NextPlay helps you decide what to play next from games you already own or can access. It is evolving into a personal game library, with Steam Family CSV import as its first practical ingestion path.

The original Budget Game Rankings app remains here as **Value Rankings**: a separate way to browse games by rating, playtime, and price when reliable PC price data is available.

---

## Product Direction

- **My Games** - owned and family-shared games, playtime, and eventually personal statuses.
- **NextPlay** - future decision support for choosing from the accessible library.
- **Value Rankings** - the existing public rating/playtime/price ranking feature.
- **Wishlist** - games the user may want to buy.

Only the existing Steam Family import and Value Rankings functionality are implemented today. Recommendations, alerts, and status management are intentionally not part of this rename.

---

## Stack

**Backend**
- Java, Spring Boot
- Spring Security + BCrypt + JWT (24-hour tokens)
- Spring Data JPA + PostgreSQL
- Flyway for database migrations
- Hosted on Railway

**Frontend**
- React + TypeScript
- Vite
- Hosted on Vercel

**Data Sources**
- [IGDB](https://api-docs.igdb.com/) — game metadata, ratings, platform/genre data (Twitch OAuth)
- [CheapShark](https://apidocs.cheapshark.com/) — lowest current price across PC storefronts (Steam, GOG, Epic, etc.)
- [HowLongToBeat](https://howlongtobeat.com/) — playtime estimates

---

## Value Rankings

**Value score:** `(IGDB rating x hours to beat) / lowest current price`

1. Game data is cached nightly from IGDB, CheapShark, and HowLongToBeat
2. User sets filters (platform, genre, price range, playtime range, release window)
3. Backend queries the cache, computes a value score for each matching game, and returns a ranked list
4. No live API calls during a user request — everything comes from the cache

**Value score formula:**
```
resolved_hours = hltb_hours if available, else genre average playtime
value_score = (igdb_rating × resolved_hours) / price_in_dollars
```

**Exclusions from main ranking:**
- Free / freemium games (shown in a separate category)
- Multiplayer-only games (no meaningful "hours to beat")
- Games with fewer than 10 IGDB user ratings
- Games with no price data and no platform-tier estimate

**Pricing scope:** CheapShark covers PC storefronts. Current console estimates remain for compatibility with the existing feature, but they are not the foundation for NextPlay and will not be expanded as a trusted pricing system.

---

## Current Features

- Public Value Rankings page - no account required
- User accounts - signup, login, JWT auth
- Saved Value Rankings configurations
- Steam Family CSV import backend for a personal library
- Admin panel - user management, manual cache refresh, sync status

---

## Architecture

```
frontend/ (React + TypeScript)  →  backend/ (Spring Boot REST API)  →  PostgreSQL
                                         ↑
                              Nightly cache refresh job
                              (IGDB → CheapShark → HowLongToBeat)
```

---

## Project History

V1 was a Java school project (Madison College, Spring 2021). V2 is the current React and Spring Boot rebuild. The original V1 demo is available [here](https://youtu.be/8lMcARkRcuE).

The original school project used: Tomcat JDBC Realm auth, MySQL 8, Hibernate 5, Maven WAR packaging, JSP/JSTL views, Bootstrap 4, jQuery DataTables, Log4j2, JUnit 4/5, hosted on AWS.
