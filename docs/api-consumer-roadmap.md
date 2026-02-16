# API Consumer Roadmap

Ziel: Die API aus Consumer-Sicht einfacher integrierbar, stabiler und planbarer weiterentwickeln.
Fokus: offene Aufgaben, gebuendelt in kleine PRs mit klarem Contract und geringem Risiko.

## Leitprinzipien

- Consumer-first: API-Entscheidungen an Integrationsaufwand und Betriebssicherheit ausrichten.
- Additiv vor Breaking: neue Felder/Parameter bevorzugt additiv einfuehren.
- Contract als Gate: OpenAPI + Contract-/Golden-Tests sind verpflichtend.
- Kleine PRs: klare Scopes, eindeutige Verantwortlichkeit, schneller Review.

## Priorisierte PR-Bundles

### 1) Query-Encoding modernisieren (CSV + Array-Style parallel)

- Branch-Name: `feat/api-query-array-style-support`
- PR-Titel: `feat(api): support repeated query params alongside csv filters`
- Scope:
  - `areas/categories` zusaetzlich als `?areas=a&areas=b` unterstuetzen.
  - CSV (`areas=a,b`) weiterhin kompatibel halten.
  - Normalisierung und Prioritaetsregel dokumentieren.
  - OpenAPI mit beiden Varianten und Beispielen aktualisieren.
- Public API:
  - Query-Contract additiv erweitert, keine Entfernung in diesem PR.

### 2) Error-Contract v2 maschinenlesbar machen

- Branch-Name: `feat/api-error-contract-v2`
- PR-Titel: `feat(api): standardize machine-readable error details for 4xx`
- Scope:
  - Konsistente Error-Details fuer 4xx: `reason`, `field`, `expected`, `actual` (wo sinnvoll).
  - Stabile Doku-Referenz pro `reason` (z. B. `docsUrl`).
  - OpenAPI-Examples fuer alle relevanten 4xx erweitern.
- Public API:
  - Error-Body additiv erweitert und vereinheitlicht.

### 3) Rate-Limit-Transparenz erweitern

- Branch-Name: `feat/api-rate-limit-headers`
- PR-Titel: `feat(api): add standard rate limit headers for clients`
- Scope:
  - Neben `Retry-After` auch `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` liefern.
  - Header-/Body-Konsistenz testen.
  - OpenAPI um Header-Dokumentation ergaenzen.
- Public API:
  - Response-Header additiv erweitert.

### 4) Pagination ergonomischer machen

- Branch-Name: `feat/api-pagination-next-pointer`
- PR-Titel: `feat(api): add next page pointer to paginated responses`
- Scope:
  - `nextOffset` (oder `next`) in `pagination` aufnehmen.
  - Optionales Cursor-Feld als spaetere Erweiterung dokumentieren.
  - Eindeutige Regeln fuer Seitenende (`null` oder nicht gesetzt).
- Public API:
  - Pagination-Meta additiv erweitert.

### 5) Discovery + Bulk fuer Consumer-Workflows

- Branch-Name: `feat/api-bulk-query-endpoints`
- PR-Titel: `feat(api): add bulk query endpoints for common client workflows`
- Scope:
  - Neuer Bulk-Read-Endpoint `POST /v1/bulk`.
  - Unterstuetzte Item-Typen: `timeseries`, `ranking`, `capabilities`.
  - An `/v1/capabilities` andocken (empfohlene Nutzungspfade).
  - Payload-Grenzen und Validierung: `items` min `1`, max `25`, fail-fast auf `400`.
- Public API:
  - Neuer Endpoint mit `results[]` in derselben Reihenfolge wie `items[]`.

### 6) Contract-Klarheit + SDK/Onboarding

- Branch-Name: `docs/api-contract-clarity-sdk-onboarding`
- PR-Titel: `docs(api): document missing-data contract and sdk-friendly usage flows`
- Scope:
  - Missing-Data-Regeln klar festlegen (`null` vs `0` vs fehlende row).
  - OpenAPI-SDK-Freundlichkeit: `operationId`, Namenskonventionen, Edge-Case-Beispiele.
  - Getting-Started mit 3 Flows dokumentieren:
    - Capabilities -> Filterwahl -> Timeseries
    - Capabilities -> Ranking
    - Revalidation via ETag/304
- Public API:
  - Primaer Doku/Contract-Deklaration, optional `operationId`-Metadaten.

### 7) Versioning- und Deprecation-Policy nach aussen festziehen

- Branch-Name: `docs/api-versioning-deprecation-policy`
- PR-Titel: `docs(api): define versioning and sunset header policy`
- Scope:
  - Explizite Policy fuer Versionierung unter `/v1`.
  - Regeln fuer `Deprecation`/`Sunset`-Header.
  - Migrationsfenster und Kommunikationsregeln festhalten.
- Public API:
  - Zunaechst Policy/Doku; technische Header-Einfuehrung ggf. in separatem `feat`.

## Testfaelle und Szenarien (Qualitaets-Gates)

1. Query-Parsing-Contract

- CSV und Array-Style liefern identische Resultate.
- Konfliktfaelle verhalten sich deterministisch.

2. Error-Contract

- Jeder relevante 4xx-Fall enthaelt die erwarteten maschinenlesbaren Felder.
- `reason` bleibt stabil (Snapshot/Golden).

3. Rate-Limit

- 429 enthaelt `Retry-After` plus `RateLimit-*`.
- Headerwerte sind konsistent und parsebar.

4. Pagination

- `nextOffset` ist korrekt bei `hasMore=true`.
- Kein `nextOffset` am Ende.

5. Bulk

- Mehrfachabfragen reduzieren Roundtrips bei identischem Datenresultat.
- Limits/Validierung begrenzen uebergrosse Requests.

6. OpenAPI/SDK

- `operationId` ist vorhanden und eindeutig.
- Beispiele decken Happy Path und Edge Cases ab.

## Risiken und Tradeoffs

- Risiko: mehrere Query-Formate erhoehen Komplexitaet.
  - Gegenmassnahme: klare Prioritaetsregel, Mapping-Tests, OpenAPI-Beispiele.

- Risiko: umfangreicherer Error-Contract fuehrt zu inkonsistenten Sonderfaellen.
  - Gegenmassnahme: zentrale Error-Schemas und gemeinsame Helper fuer 4xx.

- Risiko: zusaetzliche Rate-Limit-Header werden missinterpretiert.
  - Gegenmassnahme: exakte Semantik in Doku + Contract-Tests.

- Risiko: Bulk-Endpoints werden zu gross/teuer.
  - Gegenmassnahme: harte Request-Limits, klare Validierung, Lasttests.

## Globale Definition of Done

- OpenAPI fuer aenderte Endpoints aktualisiert.
- Contract-/Golden-Tests fuer neue/veraenderte Contracts vorhanden.
- README/Roadmap fuer Consumer-relevante Aenderungen aktualisiert.
- Checks gruen:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

## Reihenfolge der Umsetzung

1. Query-Encoding modernisieren
2. Error-Contract v2
3. Rate-Limit-Header
4. Pagination-Next-Pointer
5. Discovery + Bulk
6. Contract-Klarheit + SDK/Onboarding
7. Versioning- und Deprecation-Policy
