# Technical Debt

Systematische Analyse des Repositories, Stand Februar 2026 (2. Review).

---

## 1 — Datenbank-Schema

### 1.1 Fehlende NOT NULL Constraints (Done)

**Datei:** `src/infra/db/migrations.ts:15-23`
**Schweregrad:** hoch

Behoben durch Migration 3.

### 1.2 Fehlende UNIQUE Constraint / Primary Key (Done)

**Datei:** `src/infra/db/migrations.ts:15-23`
**Schweregrad:** hoch

Behoben durch Migration 4 (UNIQUE auf `(indicator, area_type, area_name, year)`),
finalisiert in Migration 5 mit `category` als zusätzlicher Schlüsselspalte.

### 1.3 Ranking-Query nutzt Index-Spaltenreihenfolge suboptimal

**Datei:** `src/infra/db/migrations.ts:73-75`
**Schweregrad:** niedrig

Der Unique-Index liegt auf `(indicator, area_type, area_name, year, category)`. Die Ranking-Query filtert aber auf `(indicator, area_type, year, category)` — `area_name` steht vor `year` im Index. DuckDB's Planner kann den Index möglicherweise nicht optimal nutzen.

**Lösung:** Mit `EXPLAIN` prüfen. Bei Bedarf zusätzlichen Index auf `(indicator, area_type, year, category)` anlegen.

---

## 2 — Datenbank-Verbindung

### 2.1 Einzelne Connection für alle Requests (Done)

**Datei:** `src/infra/db/duckdbConnectionManager.ts`, `src/app/plugins/repositories.ts`
**Schweregrad:** mittel

Behoben durch einen `DuckDbConnectionManager` mit kleinem Connection-Pool
(Default: 4) und Round-Robin-Verteilung über `withConnection(...)`.

### 2.2 Kein Health-/Reconnect-Mechanismus (Done)

**Datei:** `src/infra/db/duckdbConnectionManager.ts`, `src/app/routes/health.route.ts`
**Schweregrad:** mittel

Behoben durch Lazy-Reconnect im Connection-Manager: bei kaputter Connection
wird neu initialisiert und die Operation einmal wiederholt. Die Health-Route
nutzt `dbManager.healthcheck()`.

Zusätzlich abgesichert mit Health-Tests für `503` und Recovery.

### 2.3 Kein Query-Timeout (Done)

**Datei:** `src/infra/db/statisticsRepository.duckdb.ts`
**Schweregrad:** niedrig

Behoben über konfigurierbares Query-Timeout (`DB_QUERY_TIMEOUT_MS`, Default `2000`).
Repository-Queries setzen bei Timeout ein `interrupt()` und werfen einen typisierten
Infra-Timeout-Fehler.

---

## 3 — ETL Pipeline

### 3.1 ETL-Import ist nicht transaktional (Done)

**Datei:** `src/etl/importDataset.ts`
**Schweregrad:** hoch

Behoben in `src/etl/importDataset.ts` durch `BEGIN TRANSACTION`/`COMMIT` mit `ROLLBACK` im Fehlerfall.
Zusätzlich sichern Rollback-Tests beide Formate ab:
`importDataset.test.ts` (`unpivot_years` und `unpivot_categories`).

### 3.2 String-Interpolation in SQL (Done)

**Datei:** `src/etl/importDataset.ts`
**Schweregrad:** mittel

Behoben durch parametrisierte Übergabe des CSV-Pfads an `read_csv_auto(?, ...)`
statt String-Interpolation in SQL.

### 3.3 `yearParser` mit `NaN` erzeugt ungültiges SQL (Done)

**Datei:** `src/etl/importDataset.ts:42-64`
**Schweregrad:** mittel

Behoben durch Validierung via `Number.isFinite(...)` in `yearExpr` und
`yearValueExpr`. Ungültige Parser-Outputs (z. B. `NaN`) führen zu einem
beschreibenden Fehler mit Dataset- und Formatkontext.

### 3.4 Cache-Atomarität bei Fetch

**Datei:** `src/etl/fetchDataset.ts`
**Schweregrad:** niedrig

CSV wird vor der Meta-Datei geschrieben. Bei Crash zwischen beiden Schritten ist die Meta veraltet.

### 3.5 `run.ts` CLI nutzt falschen Step-Tag

**Datei:** `src/etl/cli/run.ts:21`
**Schweregrad:** niedrig

`run.ts` führt Fetch + Import aus, nutzt aber `'fetch'` als Logger-Step. Import-Phase wird mit irreführendem `step: 'fetch'` geloggt.

**Lösung:** Eigenen Step `'run'` nutzen oder separate Logger pro Phase.

### 3.6 `run.ts` überspringt fehlende CSVs nicht wie `import.ts`

**Datei:** `src/etl/cli/run.ts:22-37`
**Schweregrad:** niedrig

`import.ts` hat Logik zum Überspringen fehlender CSVs. `run.ts` bricht bei fehlendem CSV den gesamten Batch ab — inkonsistentes Fehlerverhalten.

### 3.7 CSV-Delimiter ist hardcoded

**Datei:** `src/etl/importDataset.ts:390`
**Schweregrad:** niedrig

Alle CSVs werden mit `delim=';'` geladen. Nicht per Dataset konfigurierbar.

**Lösung:** Optionales `csvDelimiter`-Feld in `DatasetConfig` ergänzen.

### 3.8 `rowid`-Ordering in `dedupeByAreaYearKeepLast` ist fragil

**Datei:** `src/etl/importDataset.ts:286-294`
**Schweregrad:** niedrig

`ORDER BY rowid DESC` setzt voraus, dass `rowid` die CSV-Reihenfolge widerspiegelt — undokumentiertes Verhalten von `read_csv_auto`.

### 3.9 `importDataset.ts` schließt `DuckDBInstance` nicht (Done)

**Datei:** `src/etl/importDataset.ts:413-416`
**Schweregrad:** mittel

Behoben: im `finally`-Block werden sowohl `conn.closeSync()` als auch
`db.closeSync()` aufgerufen (jeweils abgesichert per try/catch).

### 3.10 Keine CLI-Konfiguration für Retry-Parameter

**Datei:** `src/etl/cli/fetch.ts`
**Schweregrad:** niedrig

Retry-Einstellungen (Anzahl, Delays, Timeout) nicht per CLI-Argument konfigurierbar.

### 3.11 `yearParser`-Output hat keine Range-Validierung

**Dateien:** `src/etl/datasets/districts_gender.ts:13-15`, `districts_marital_status.ts:12-15`, `districts_households_type_size.ts:13-15`
**Schweregrad:** niedrig

Die `yearParser`-Funktionen extrahieren eine 4-stellige Zahl aus einem Datumsstring ohne Plausibilitätsprüfung (z.B. `1900–2100`).

---

## 4 — Code Quality

### 4.1 `resolveDatasets`/`usage` in 3 CLI-Dateien dupliziert

**Dateien:** `src/etl/cli/fetch.ts:10-17`, `import.ts:10-17`, `run.ts:11-18`
**Schweregrad:** niedrig

Alle drei CLI-Files enthalten eine identische `resolveDatasets(argv)`-Funktion und `usage()`-Funktion.

**Lösung:** In gemeinsames `src/etl/cli/shared.ts` extrahieren. Script-Name als Parameter übergeben.

### 4.2 DELETE-before-INSERT Pattern dupliziert

**Datei:** `src/etl/importDataset.ts:100-117, 230-262`
**Schweregrad:** niedrig

Beide Import-Funktionen wiederholen das SELECT COUNT → Log → DELETE Pattern wortgleich.

**Lösung:** Gemeinsame `deleteExisting()`-Hilfsfunktion extrahieren.

### 4.3 Two-Pass-Loop in `importUnpivotCategories` ist fragil

**Datei:** `src/etl/importDataset.ts:230-342`
**Schweregrad:** niedrig

Die Funktion iteriert zweimal über `format.columns` (erst DELETE, dann INSERT) mit inkonsistenten Guard-Bedingungen. Der Guard auf Zeile 265 nutzt ein stilles `continue` statt eines Throws.

**Lösung:** Columns vorab in einem Pass validieren, dann koordiniert DELETE + INSERT.

### 4.4 `yearValueExpr` und `yearExpr` fast identisch

**Datei:** `src/etl/importDataset.ts:42-64`
**Schweregrad:** niedrig

Beide Funktionen generieren einen `CASE year ... END`-Ausdruck, unterscheiden sich nur im Spaltenalias.

**Lösung:** Zu einer Funktion mit `columnAlias`-Parameter zusammenführen.

### 4.5 `quoteLiteral`/`quoteIdentifier` nicht exportiert/getestet

**Datei:** `src/etl/importDataset.ts:27-33`
**Schweregrad:** niedrig

Modul-lokale SQL-Hilfsfunktionen, nicht wiederverwendbar.

**Lösung:** Exportieren und unit-testen, oder nach `src/etl/sql.ts` verschieben.

### 4.6 `makeEnv` in `path.test.ts` dupliziert

**Dateien:** `src/test/helpers/makeEnv.ts`, `src/config/path.test.ts:9-23`
**Schweregrad:** niedrig

`path.test.ts` definiert eine lokale `makeEnv`-Kopie statt den Test-Helper zu importieren.

---

## 5 — Type Safety

### 5.1 `requireString` konvertiert Non-Strings stillschweigend (Done)

**Datei:** `src/infra/db/statisticsRepository.duckdb.ts:21-24`
**Schweregrad:** niedrig

Behoben: `requireString` prüft strikt auf `typeof value === 'string'` und wirft
bei Nicht-String einen Fehler.

### 5.2 `filterColumn`+`filterValue` erlauben Mismatch

**Datei:** `src/etl/datasets/types.ts:30-40`
**Schweregrad:** niedrig

Beide Felder sind optional. `filterColumn` ohne `filterValue` wird stillschweigend ignoriert.

**Lösung:** Discriminated Union nutzen: `{ filterColumn: string; filterValue: string } | {}`.

### 5.3 `UnpivotCategoriesColumn` erlaubt weder `valueColumn` noch `valueExpression`

**Datei:** `src/etl/datasets/types.ts:19-28`
**Schweregrad:** niedrig

Beide Felder optional — ein Column-Config ohne beides ist typgültig. Erst zur Laufzeit (Zeile 231) fällt es auf.

**Lösung:** Discriminated Union: `{ valueColumn: string } | { valueExpression: string }`.

### 5.4 `LoggerLike` in `duckdb.ts` ist handgeschriebene Pino-Kopie (Done)

**Datei:** `src/infra/db/duckdb.ts:9-13`
**Schweregrad:** niedrig

Behoben: Typisierung auf `Pick<Logger, 'info' | 'warn' | 'error'>` umgestellt.

---

## 6 — Error Handling

### 6.1 Repository-Methoden haben kein Error Handling (Done)

**Datei:** `src/infra/db/statisticsRepository.duckdb.ts`
**Schweregrad:** mittel

Behoben durch zentrale Repository-Query-Helfer mit:

- typisierten Infra-Errors (`RepositoryInfraError`, `RepositoryQueryTimeoutError`)
- Query-Kontext im Log
- Timeout + `interrupt()`-Handling.

### 6.2 NULL-Werte im Row-Mapping (Done)

Behoben durch `requireValue`/`requireString`/`requireNumber` + NOT NULL Constraints.

### 6.3 `createDb` wirft `unknown` (Done)

Behoben.

---

## 7 — Architecture

### 7.1 Service-Layer Category-Filter ist redundant

**Datei:** `src/domains/statistics/services/queryService.ts:15-19, 32-36`
**Schweregrad:** mittel

Der QueryService filtert in-memory nach `category`, aber das Repository filtert bereits per SQL (`category = ?` mit Default `'total'`). Der Service-Filter ist toter Code für den Normalfall.

**Lösung:** Entweder den In-Memory-Filter aus dem Service entfernen (DB filtert bereits) oder das DB-Filtering in den Service verlagern.

### 7.2 `getEnv()` wird in Route-Handlern aufgerufen

**Datei:** `src/app/routes/health.route.ts:33`
**Schweregrad:** niedrig

Direkter Zugriff auf den Environment-Singleton im Request-Handler statt über Fastify-Decoration.

### 7.3 Layer-Boundaries nicht für `etl/`, `schemas/` durchgesetzt

**Datei:** `eslint.config.mjs:89-141`
**Schweregrad:** niedrig

ESLint-Regeln verhindern nicht, dass `etl/` aus `app/` importiert oder `schemas/` aus `domains/`.

**Lösung:** Zusätzliche `import/no-restricted-paths`-Regeln ergänzen.

### 7.4 Root `/` Endpoint regeneriert Swagger-Spec bei jedem Request

**Datei:** `src/app/routes/health.route.ts:34`
**Schweregrad:** niedrig

`app.swagger()` wird bei jedem Request auf `/` aufgerufen, auch in Production.

**Lösung:** Pfad-Liste einmalig nach `app.ready()` cachen.

---

## 8 — Tests

### 8.1 OpenAPI-Test fehlt für `/v1/indicators` und `/v1/area-types`

**Datei:** `src/app/routes/openapi.test.ts:38-44`
**Schweregrad:** niedrig

Die neuen Discovery-Endpoints sind nicht im OpenAPI-Spec-Test enthalten.

### 8.2 Kein Service-Level-Test für `category === undefined`

**Datei:** `src/domains/statistics/services/queryService.test.ts`
**Schweregrad:** niedrig

Die Early-Return-Pfade in `getTimeseries` und `getRanking` (wenn `category` undefined ist) werden auf Service-Ebene nicht getestet.

### 8.3 Kein Repo-Test für `listAreas` mit Category-Filter

**Datei:** `src/infra/db/statisticsRepository.duckdb.test.ts`
**Schweregrad:** niedrig

`listAreas` hat einen `category`-Filter im SQL, aber kein Test übt diesen aus.

### 8.4 Kein Integrationstest für `/health` mit 503

**Datei:** `src/app/routes/health.route.ts:54-58`
**Schweregrad:** niedrig

Der 503-Branch (wenn `SELECT 1` fehlschlägt) wird nicht per Integration-Test abgedeckt.

### 8.5 `resolveDatasets` CLI-Parser ist nicht getestet

**Dateien:** `src/etl/cli/fetch.ts`, `import.ts`, `run.ts`
**Schweregrad:** niedrig

### 8.6 ETL-Transaction-Rollback nicht getestet

**Schweregrad:** niedrig

Kein Test prüft, ob bei INSERT-Fehler korrekt zurückgerollt wird.

---

## 9 — Konfiguration

### 9.1 `SWAGGER_UI_ENABLED` nutzt manuelle String-zu-Bool-Konvertierung

**Datei:** `src/config/env.ts:17,26-29`
**Schweregrad:** niedrig

Werte wie `'yes'`, `'1'` oder `'TRUE'` werden stillschweigend als `false` behandelt.

**Lösung:** `z.enum(['true', 'false']).transform(...)` oder `z.coerce.boolean()` nutzen.

### 9.2 `PORT` hat keine Obergrenze

**Datei:** `src/config/env.ts:9`
**Schweregrad:** niedrig

`positive()` erlaubt Werte > 65535.

**Lösung:** `.max(65535)` ergänzen.

---

## 10 — Dependencies

### 10.1 `@types/node` Version ahead of Engine-Requirement

**Datei:** `package.json:30`
**Schweregrad:** niedrig

`engines` erfordert Node `>=20`, aber `@types/node` ist `^25.x`. Könnte APIs exponieren, die in Node 20 nicht existieren.

**Lösung:** `@types/node` auf `^20.x` pinnen.

### 10.2 `pino-pretty` ist Production-Dependency

**Datei:** `package.json`
**Schweregrad:** niedrig

`pino-pretty` wird nur in Development/Test genutzt, ist aber unter `dependencies` gelistet.

**Lösung:** Nach `devDependencies` verschieben, Docker-Image-Size reduzieren.

---

## 11 — Observability

### 11.1 Keine Request-/Query-Metriken

**Schweregrad:** niedrig

Kein Prometheus-Endpoint, keine Query-Duration-Metriken.

### 11.2 Kein Step-Timing im ETL

**Datei:** `src/etl/importDataset.ts`
**Schweregrad:** niedrig

Gesamt-Dauer wird geloggt, aber nicht einzelne Schritte.

---

## Zusammenfassung

| #    | Thema                                          | Schweregrad | Status |
| ---- | ---------------------------------------------- | ----------- | ------ |
| 3.1  | ETL-Import ist nicht transaktional             | hoch        | done   |
| 1.1  | Fehlende NOT NULL Constraints                  | hoch        | done   |
| 1.2  | Fehlende UNIQUE Constraint                     | hoch        | done   |
| 2.1  | Einzelne DB-Connection für alle Requests       | mittel      | done   |
| 2.2  | Kein Reconnect-Mechanismus                     | mittel      | done   |
| 3.2  | String-Interpolation in ETL-SQL                | mittel      | done   |
| 3.3  | `yearParser` NaN erzeugt ungültiges SQL        | mittel      | done   |
| 3.9  | `importDataset` schließt DB-Instance nicht     | mittel      | done   |
| 6.1  | Kein Error Handling im Repository              | mittel      | done   |
| 7.1  | Redundanter Category-Filter im Service         | mittel      | offen  |
| 1.3  | Ranking-Index suboptimal                       | niedrig     | offen  |
| 2.3  | Kein Query-Timeout                             | niedrig     | done   |
| 3.4  | Cache-Atomarität bei Fetch                     | niedrig     | offen  |
| 3.5  | `run.ts` falscher Logger-Step                  | niedrig     | offen  |
| 3.6  | `run.ts` überspringt keine fehlenden CSVs      | niedrig     | offen  |
| 3.7  | CSV-Delimiter hardcoded                        | niedrig     | offen  |
| 3.8  | `rowid`-Ordering fragil                        | niedrig     | offen  |
| 3.10 | Keine CLI-Retry-Konfiguration                  | niedrig     | offen  |
| 3.11 | yearParser keine Range-Validierung             | niedrig     | offen  |
| 4.1  | `resolveDatasets`/`usage` dupliziert           | niedrig     | offen  |
| 4.2  | DELETE-before-INSERT dupliziert                | niedrig     | offen  |
| 4.3  | Two-Pass-Loop fragil                           | niedrig     | offen  |
| 4.4  | `yearValueExpr`/`yearExpr` fast identisch      | niedrig     | offen  |
| 4.5  | SQL-Helpers nicht exportiert/getestet          | niedrig     | offen  |
| 4.6  | `makeEnv` dupliziert                           | niedrig     | offen  |
| 5.1  | `requireString` konvertiert stillschweigend    | niedrig     | done   |
| 5.2  | `filterColumn`+`filterValue` Mismatch möglich  | niedrig     | offen  |
| 5.3  | Column ohne valueColumn/valueExpression gültig | niedrig     | offen  |
| 5.4  | `LoggerLike` handgeschrieben                   | niedrig     | done   |
| 6.2  | NULL-Werte im Row-Mapping                      | mittel      | done   |
| 6.3  | `createDb` wirft `unknown`                     | niedrig     | done   |
| 7.2  | `getEnv()` in Route-Handler                    | niedrig     | offen  |
| 7.3  | Layer-Boundaries unvollständig                 | niedrig     | offen  |
| 7.4  | Swagger-Spec bei jedem `/`-Request generiert   | niedrig     | offen  |
| 8.1  | OpenAPI-Test fehlt für neue Endpoints          | niedrig     | offen  |
| 8.2  | Service-Test für `category === undefined`      | niedrig     | offen  |
| 8.3  | Repo-Test für `listAreas` mit Category         | niedrig     | offen  |
| 8.4  | Health 503 Integrationstest fehlt              | niedrig     | offen  |
| 8.5  | CLI-Parser nicht getestet                      | niedrig     | offen  |
| 8.6  | ETL-Rollback nicht getestet                    | niedrig     | offen  |
| 9.1  | `SWAGGER_UI_ENABLED` manuelle Konvertierung    | niedrig     | offen  |
| 9.2  | `PORT` keine Obergrenze                        | niedrig     | offen  |
| 10.1 | `@types/node` zu neue Version                  | niedrig     | offen  |
| 10.2 | `pino-pretty` als Prod-Dependency              | niedrig     | offen  |
| 11.1 | Keine Request-Metriken                         | niedrig     | offen  |
| 11.2 | Kein ETL-Step-Timing                           | niedrig     | offen  |

---

## Clustering (PR-Zuschnitt für offene Punkte)

### Cluster A — ETL Stabilität & Betriebsverhalten

**Empfohlene gemeinsame PR-Issues:** `3.4`, `3.5`, `3.6`, `3.7`, `3.10`, `8.5`

- Gemeinsamer Scope: Fetch/Run-CLI Verhalten, Retry-Konfiguration, CSV-Ladeparameter.
- Gute Bündelung, weil alles ETL-Operator-UX und Laufzeitrobustheit betrifft.

### Cluster B — ETL Datenkonsistenz & Parser-Härtung

**Empfohlene gemeinsame PR-Issues:** `3.8`, `3.11`, `5.2`, `5.3`, `8.6`

- Gemeinsamer Scope: Korrektheit bei Year-Parsing, Dedupe-Determinismus, Config-Validierung.
- Gute Bündelung, weil alles Datenintegrität im Importpfad betrifft.

### Cluster C — ETL/CLI Refactoring Cleanup

**Empfohlene gemeinsame PR-Issues:** `4.1`, `4.2`, `4.3`, `4.4`, `4.5`

- Gemeinsamer Scope: Duplikate abbauen, fragilen Kontrollfluss bereinigen, Helper konsolidieren.
- Reiner Refactor-Block, getrennt von Behavioral-Fixes.

### Cluster D — DB Zugriff & Fehlerbehandlung

**Empfohlene gemeinsame PR-Issues:** `2.3`, `3.9`, `6.1`, `5.1`, `5.4`

- Gemeinsamer Scope: Timeout/Failure-Handling, DB-Resource-Lifecycle, strikteres Mapping/Logging-Typen.
- Gute Bündelung für Reliability in DB-Layer + Repository.

### Cluster E — App Layer / Architekturgrenzen

**Empfohlene gemeinsame PR-Issues:** `7.1`, `7.2`, `7.3`, `7.4`

- Gemeinsamer Scope: Layering, Handler-Responsibility, unnötige Laufzeitarbeit in Root-Route.
- Gute Bündelung für Architektur- und Performance-Bereinigung.

### Cluster F — Tests vervollständigen

**Empfohlene gemeinsame PR-Issues:** `8.1`, `8.2`, `8.3`, `8.4`

- Gemeinsamer Scope: fehlende API-/Service-/Repo-/Integrationstests.
- Test-only PR, geringes Risiko für Seiteneffekte.

### Cluster G — Config & Dependencies Hygiene

**Empfohlene gemeinsame PR-Issues:** `9.1`, `9.2`, `10.1`, `10.2`

- Gemeinsamer Scope: Konfig-Parsing/Validierung und Dependency-Hygiene.
- Sinnvoll als separater Maintenance-PR.

### Cluster H — Observability

**Empfohlene gemeinsame PR-Issues:** `11.1`, `11.2`

- Gemeinsamer Scope: Metriken und ETL-Step-Timing.
- Eigenständiger Telemetrie-PR mit klarer Abnahme.

### Cluster I — Optionaler Einzel-PR

**Empfohlener Einzel-PR-Issue:** `1.3`

- Ranking-Index-Optimierung sollte per `EXPLAIN` verifiziert werden und kann isoliert bleiben.

## Priorisierte Reihenfolge (Roadmap)

### PR 1 (höchste Priorität) — DB Reliability Core

- Cluster: **D** (`2.3`, `3.9`, `6.1`, `5.1`, `5.4`)
- Branch: `fix/db-reliability-timeout-and-error-handling`
- PR-Titel: `fix(db): harden repository error handling and db lifecycle`

### PR 2 — ETL Datenkonsistenz

- Cluster: **B** (`3.8`, `3.11`, `5.2`, `5.3`, `8.6`)
- Branch: `fix/etl-data-consistency-and-parser-validation`
- PR-Titel: `fix(etl): harden parser and dedupe consistency safeguards`

### PR 3 — ETL Betrieb/CLI Robustheit

- Cluster: **A** (`3.4`, `3.5`, `3.6`, `3.7`, `3.10`, `8.5`)
- Branch: `fix/etl-cli-runtime-robustness`
- PR-Titel: `fix(etl): improve cli runtime behavior and retry controls`

### PR 4 — Fehlende Testabdeckung

- Cluster: **F** (`8.1`, `8.2`, `8.3`, `8.4`)
- Branch: `test/api-service-repo-coverage-gaps`
- PR-Titel: `test(api): close integration and service test coverage gaps`

### PR 5 — App Layer Cleanup

- Cluster: **E** (`7.1`, `7.2`, `7.3`, `7.4`)
- Branch: `refactor/app-layer-boundaries-and-root-performance`
- PR-Titel: `refactor(app): tighten boundaries and optimize root route`

### PR 6 — ETL/CLI Refactor (nur Struktur)

- Cluster: **C** (`4.1`, `4.2`, `4.3`, `4.4`, `4.5`)
- Branch: `refactor/etl-cli-duplication-cleanup`
- PR-Titel: `refactor(etl): remove duplication in cli and import flow`

### PR 7 — Config & Dependency Hygiene

- Cluster: **G** (`9.1`, `9.2`, `10.1`, `10.2`)
- Branch: `chore/config-and-dependency-hygiene`
- PR-Titel: `chore(repo): tighten config parsing and dependency hygiene`

### PR 8 — Observability

- Cluster: **H** (`11.1`, `11.2`)
- Branch: `feat/observability-request-and-etl-metrics`
- PR-Titel: `feat(observability): add request and etl step metrics`

### PR 9 (optional, isoliert) — Ranking Index Tuning

- Cluster: **I** (`1.3`)
- Branch: `perf/db-ranking-index-order`
- PR-Titel: `perf(db): optimize ranking index access pattern`
