# API Consumer Roadmap

Ziel: Die API aus Consumer-Sicht einfacher integrierbar, stabiler und performanter machen.
Liefermodell: kleine, unabhängige PRs mit klaren Contracts und geringem Rollback-Risiko.

## Erfolgsmetriken

- Time-to-first-successful-request für neue Consumer
- Anteil erfolgreicher Retries nach `429`
- Anteil `304 Not Modified` bei wiederholten GET-Requests
- Anzahl Rückfragen/Tickets zu Query-Parametern und Fehlerformaten

### OpenAPI-Beispiele vervollständigen

- Ziel: Integrationsstart vereinfachen.
- Scope:
  - Success- und Error-Beispiele (`400`, `404`, `429`) für Kernendpunkte.
  - Doku zu CSV-Filtern und Edge Cases ergänzen.
  - OpenAPI-Tests auf `examples`.
- Out of Scope:
  - Laufzeitverhalten der Endpunkte.
- DoD:
  - `/docs` zeigt pro Kernendpoint mind. ein Success- und ein Error-Beispiel.
  - Tests schlagen fehl, wenn Beispiele fehlen.

### Query-Parameter-Bereinigung auf Plural-Format (`areas`, `categories`)

- Ziel: konsistentere Consumer-Parameter.
- Scope:
  - Legacy-Parameter `area`/`category` entfernen.
  - Endpunkte mit CSV-Listen auf `areas`/`categories` vereinheitlichen.
  - Route- und Contract-Tests auf plural-only aktualisieren.
- Out of Scope:
  - Weitere Query-Umbenennungen außerhalb von `timeseries`/`ranking`.
- DoD:
  - Nur `areas`/`categories` sind für CSV-Filter gültig.
  - Legacy-Parameter liefern 400 (Invalid query parameters).

Migration:

- `/v1/timeseries?...&area=Altstadt,Vorstadt` -> `/v1/timeseries?...&areas=Altstadt,Vorstadt`
- `/v1/ranking?...&category=male,female` -> `/v1/ranking?...&categories=male,female`

### Maschinenlesbare Error-Reason-Codes

- Ziel: Fehlerbehandlung für Consumer automatisierbar machen.
- Scope:
  - Stabile `reason`-Codes im Error-Body bei 400-Validierungsfehlern.
  - Optional vorbereitete `suggestions` bei Domain-Validation.
- Out of Scope:
  - Vollständige i18n-Fehlermeldungen.
- DoD:
  - Alle validierungsbezogenen 400-Antworten enthalten `reason`.
  - Dokumentation + Tests vorhanden.

### HTTP-Caching (ETag / If-None-Match / 304 / Cache-Control)

- Ziel: Performance und Netzlast verbessern.
- Scope:
  - `ETag` für alle `GET /v1/*` Endpunkte.
  - `If-None-Match` verarbeiten und `304` liefern.
  - `Cache-Control: public, max-age=60`.
- Out of Scope:
  - CDN-/Reverse-Proxy-Strategien.
- DoD:
  - Wiederholte identische Requests führen zu `304`.
  - Header-Verhalten durch Tests abgesichert.

### Data-Freshness sichtbar machen

- Ziel: Datenstand ohne Zusatz-Requests erkennbar machen.
- Scope:
  - `Data-Version` und `Last-Updated-At` als Response-Header für `GET /v1/*`.
  - Swagger/Contract-Doku aktualisieren.
- Out of Scope:
  - Neue dedizierte Freshness-Endpunkte.
- DoD:
  - Consumer kann Datenstand eindeutig erkennen.
  - Tests und OpenAPI aktualisiert.

### Rate-Limit UX verbessern (`Retry-After`)

- Ziel: sauberes Retry-Verhalten für Consumer.
- Scope:
  - `Retry-After` Header bei `429`.
  - Body und Header semantisch konsistent.
- Out of Scope:
  - Komplett neue Rate-Limit-Strategie.
- DoD:
  - `429` enthält verwertbare Retry-Informationen in Header und Body.
  - Tests decken Werte und Format ab.

### Pagination (additiv, rückwärtskompatibel)

- Ziel: große Antworten kontrollierbar machen.
- Scope:
  - `limit`/`offset` für große Collections.
  - Response-Metadaten: `total`, `limit`, `offset`, `hasMore`.
  - Startendpunkte: `/v1/timeseries`, `/v1/indicators`, `/v1/years`.
- Out of Scope:
  - Cursor-Pagination.
- DoD:
  - Große Responses seitenweise abrufbar.
  - Default-Verhalten bleibt kompatibel.
  - Last-/Regressionstests vorhanden.

### Capabilities-Endpoint

- Ziel: Discovery für Clients mit einem Request.
- Scope:
  - Endpoint `/v1/capabilities`.
  - Felder: `areaTypes`, `indicators`, `years`, technische Limits.
- Out of Scope:
  - Vollständige Self-Describing-Schema-Engine.
- DoD:
  - Frontend kann initiale Discovery mit einem Call machen.
  - OpenAPI und Tests vollständig.

### Deprecation + Contract-Tests in CI

- Ziel: kontrollierte Weiterentwicklung ohne unbeabsichtigte Breaking Changes.
- Scope:
  - Entfernte Parameter über Contract-Tests absichern.
  - Migration auf den neuen Query-Contract dokumentieren.
  - Golden-Tests für Payload-/Error-/Header-Contracts.
  - CI-Gate für Contract-Regressionen.
- Out of Scope:
  - Wieder-Einführung von Legacy-Query-Parametern.
- DoD:
  - Breaking Contract-Änderungen schlagen in CI fehl.
  - Migration dokumentiert.

## PR-Bündelung nach Git Convention

Umsetzung in kleinen, risikoarmen Paketen mit klarer Reihenfolge:

1. OpenAPI-Beispiele vervollständigen
   - Enthaltene Tasks:
     - OpenAPI-Beispiele vervollständigen
   - Branch-Name: `docs/api-openapi-examples`
   - PR-Titel: `docs(api): complete OpenAPI examples for core endpoints`

2. Error-Contract für Consumer-Retries und Validation
   - Enthaltene Tasks:
     - Maschinenlesbare Error-Reason-Codes
     - Rate-Limit UX verbessern (`Retry-After`)
   - Branch-Name: `feat/api-error-reasons-retry-after`
   - PR-Titel: `feat(api): add reason codes and retry-after for 4xx responses`

3. Query-Parameter-Bereinigung und Contract-Absicherung
   - Enthaltene Tasks:
     - Query-Parameter-Bereinigung auf Plural-Format (`areas`, `categories`)
     - Deprecation + Contract-Tests in CI
   - Branch-Name: `feat/api-query-contract-plural-only`
   - PR-Titel: `feat(api): remove legacy query params and enforce plural contract`

4. Caching und Freshness-Metadaten gemeinsam ausrollen
   - Enthaltene Tasks:
     - HTTP-Caching (ETag / If-None-Match / 304 / Cache-Control)
     - Data-Freshness sichtbar machen
   - Branch-Name: `feat/api-conditional-get-caching-freshness`
   - PR-Titel: `feat(api): implement conditional get caching and freshness metadata`

5. Pagination isoliert als eigenes Risiko-Paket
   - Enthaltene Tasks:
     - Pagination (additiv, rückwärtskompatibel)
   - Branch-Name: `feat/api-offset-pagination`
   - PR-Titel: `feat(api): add additive offset pagination for collections`

6. Discovery als separater Endpoint
   - Enthaltene Tasks:
     - Capabilities-Endpoint
   - Branch-Name: `feat/api-capabilities-endpoint`
   - PR-Titel: `feat(api): add capabilities discovery endpoint`

## Risiken und Gegenmaßnahmen

- Risiko: Pagination verursacht unbeabsichtigte Antwortänderungen.
- Gegenmaßnahme: additive Felder, Default-Verhalten unverändert, Golden-Tests.

- Risiko: Caching liefert stale Daten bei ETL-Cutover.
- Gegenmaßnahme: ETag an `dataVersion` koppeln und bei Datenwechsel invalidieren.

- Risiko: Mehrere Parametervarianten erhöhen Komplexität.
- Gegenmaßnahme: klare Deprecation-Timeline, Contract-Tests, Sunset-Kommunikation.
