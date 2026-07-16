# Historical Atlas — prosjektbeslutninger

Webapplikasjon som viser hvordan Europas landegrenser endrer seg over tid.
Brukeren drar en tidslinje-slider, og kartet tegner grensene slik de var.

**MVP i én setning: Europas grenser, dradd gjennom tid.**

Alt som ikke tjener den setningen er utenfor. Dette dokumentet finnes for å
huske hvorfor beslutningene ble tatt, slik at de ikke gjøres om av vanvare.

Status: **Fase 1 komplett.** Skjema opprettet via Flyway (V1__init_schema),
710 rader importert fra `staging.cshapes_raw` til den normaliserte modellen
via et frittstående JDBC-verktøy (`ImportRunner.java`), `data_source` fylt
med lisens og attribusjon. Porten bestått mot to uavhengige årstall:
151 land i 1910 (identisk med rådataene), 169 i 1925 (med Polen til
stede). Se "Fase 1" under Tidsløp for detaljer. Neste steg: Fase 2
(backend, ett endepunkt).

---

## Beslutninger i korte trekk

| Område | Valg |
|---|---|
| Datakilde | CShapes 2.0 (ETH Zürich) |
| Lisens | CC BY-NC-SA 4.0 — kun ikke-kommersiell bruk |
| Database | PostgreSQL + PostGIS 3.6-alpine (Docker), port **5433** på verten |
| Backend | Spring Boot, REST, GeoJSON |
| Frontend | MapLibre GL JS, ingen rammeverk, ingen byggesteg |
| Bakgrunnskart | Ingen |
| Tidsmodell | Intervaller (`valid_from` / `valid_to`), `DATE` |
| Hosting | Gratis, offentlig URL |

---

## 1. Datagrunnlag

### Valgt: CShapes 2.0

Kartlegger grenser og hovedsteder for selvstendige stater og avhengige
territorier globalt fra 1886 til 2019. Akademisk kvalitetssikret, publisert i
Journal of Conflict Resolution. Leveres som CSV, GeoJSON, Shapefile, SQL og
R-pakke.

Kilde: https://icr.ethz.ch/data/cshapes/

**Hvorfor denne:**

1. Har allerede intervallmodellen — hver polygon har gyldig-fra/gyldig-til.
   Det er nøyaktig strukturen en tidsslider trenger.
2. Global dekning fra 1886. Ambisjonen om et globalt atlas krever ikke
   kildebytte, bare utvidet region.
3. Kvaliteten holder. Ingen kvelder brukt på å rette feil i kildedata.

**Hva vi aksepterte:** ingen dekning før 1886 globalt, og ingen kommersiell
bruk noensinne.

### Utvidelse nummer én: CShapes-Europe

Går tilbake til 1816. Inneholder tysk og italiensk samling — de mest
dramatiske grenseendringene i europeisk historie, og det som får en
tidsslider til å føles magisk. Egen sitering (Cederman, Girardin,
Müller-Crepon, Pengl).

Legges til *etter* at MVP er deployet. Da beviser den samtidig at
flerkilde-designet fungerer.

### Vurdert og valgt bort

- **historical-basemaps** (GPL-3.0, GeoJSON, forhistorie–1994). Global og
  går dypt tilbake i tid, men grov: eksplisitt «work in progress», med
  dokumentert 20 km forskyvning i noen filer. Har et `BORDERPRECISION`-felt
  (1–3) som er en god idé vi har stjålet. Aktuell hvis kommersiell bruk
  noen gang blir nødvendig.
- **OpenHistoricalMap** (CC0, fri). Eneste kilden uten lisensbegrensninger,
  og har allerede tidsslider-konseptet. Dekningen er for tynn i dag —
  mange flere punkter enn polygoner. Verdt å følge med på.

### Lisensforpliktelser — må implementeres

CC BY-NC-SA 4.0 krever navngivelse og at avledede data deles under samme
lisens. Dette er ikke valgfritt.

- [ ] `DATA_SOURCES.md` med kilde, lisens, lenke og akademisk sitering
- [ ] Synlig «Kilder»-lenke i appen
- [ ] `GET /api/v1/sources` som eksponerer `data_source`-tabellen

Sitering som skal med:

> Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman,
> Nils Weidmann og Kristian Skrede Gleditsch. 2022. "Mapping The
> International System, 1886-2017: The CShapes 2.0 Dataset."
> Journal of Conflict Resolution 66(1): 144–61.

---

## 2. Datamodell

Fagbegrepet er **valid time** — perioden en rad var sann i den virkelige
verden. Ikke bitemporal; vi trenger ikke spore når rader ble lagt inn.

Kjerneidé: **én rad per periode med stabile grenser.** Endrer en grense seg,
lukkes den gamle raden og en ny åpnes. Et land som ikke eksisterte har ingen
rad — ikke en tom polygon.

```sql
CREATE TABLE polity (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    gw_code     INTEGER,
    wikidata_id VARCHAR(20)
);

CREATE TABLE data_source (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    license     VARCHAR(100) NOT NULL,
    attribution TEXT NOT NULL,
    url         VARCHAR(500)
);

CREATE TABLE territory_version (
    id         BIGSERIAL PRIMARY KEY,
    polity_id  BIGINT NOT NULL REFERENCES polity(id),
    geom       GEOMETRY(MultiPolygon, 4326) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to   DATE,
    precision  SMALLINT,
    source_id  BIGINT NOT NULL REFERENCES data_source(id)
);

CREATE INDEX idx_tv_validity ON territory_version (valid_from, valid_to);
CREATE INDEX idx_tv_geom ON territory_version USING GIST (geom);
```

**Feltnotater:**

- `polity` er statsenheten som konsept. «Frankrike» finnes én gang og
  overlever på tvers av mange `territory_version`-rader.
- `valid_to NULL` betyr «gjelder fortsatt».
- `DATE`, ikke årstall. CShapes har faktiske datoer, og informasjon som
  rundes bort kommer ikke tilbake. Slideren kan fortsatt kjøre i
  årsoppløsning og sende `1910-01-01`.
- `gw_code` er Gleditsch og Ward-koden. Nøkkelen tilbake til kildedata.
- `precision` er `BORDERPRECISION`-idéen fra historical-basemaps.
  **Blir NULL for alt i MVP** — CShapes har ikke feltet. Den er der for
  kilde nummer to, og kan ikke rekonstrueres senere.
- `data_source` er det som gjør kildebytte mulig uten omskriving. Hver
  polygon vet hvor den kom fra.

### Kjernespørringen — hele appen

```sql
SELECT p.name, tv.geom, tv.precision
FROM territory_version tv
JOIN polity p ON p.id = tv.polity_id
WHERE tv.valid_from <= :date
  AND (tv.valid_to IS NULL OR tv.valid_to > :date);
```

### Importnotater — verifisert mot rådata i fase 0

`cshapes_raw` (staging-tabellen `ogr2ogr` genererer) avslørte to detaljer
som ikke sto i dokumentasjonen, og som importskriptet i fase 1 må håndtere:

- **`gwedate` er inklusiv, ikke eksklusiv.** Polens rader går
  `...→1919-06-27` og neste starter `1919-06-28`. Modellens `valid_to` er
  eksklusiv (`valid_to > :date`), så importen må sette
  `valid_to = gwedate + INTERVAL '1 day'`. Kopiert rått ville hvert land
  forsvunnet ett døgn for tidlig ved hver grenseendring — en feil som er
  usynlig med mindre du sjekker akkurat den datoen.
- **`gwcode` blir `numeric(9,0)`, ikke heltall.** Shapefile-formatet skiller
  ikke mellom heltall og desimaltall i `.dbf`, så GDAL velger det trygge.
  Importen caster eksplisitt: `gwcode::integer AS gw_code`.

Bekreftet samtidig: `gwsdate`/`gwedate` ble faktiske `date`-kolonner (ikke
tekst), og streng-felt som `capname` fikk riktig UTF-8 — men bare fordi
importen kjørte med `--config SHAPE_ENCODING ISO-8859-1`. Uten det flagget
feiler `ogr2ogr` på første landnavn med aksent (Kongo, Kinshasa
(Léopoldville)), fordi CShapes' `.dbf` mangler kodesideflagget GDAL normalt
leser dette fra.

### Øyeblikksbilder vs. intervaller

Intervallmodellen kan representere begge kildetyper. En øyeblikksbildekilde
(`world_1800.geojson`) konverteres ved import: hver polygon får
`valid_from = 1800` og `valid_to =` året for neste øyeblikksbilde. Motsatt
vei går ikke.

**Konsekvens: ingen abstraksjon i domenemodellen.** Utvidelsespunktet ligger
i importlaget, der det er billig. Vil du ha Romerriket om to år, skriver du
en ny importer. Modellen står urørt.

---

## 3. Database

**PostgreSQL + PostGIS 3.6, Alpine-variant.** Ikke MySQL, selv om MySQL 8
har romlig støtte, og ikke standard Debian-image, selv om det er det
`docker run` gir deg uten å spesifisere noe.

Avgjørende funksjoner MySQL mangler:

- `ST_CoverageSimplify` — se Risiko 1. Kom i PostGIS 3.4.
- `ST_CoverageClean` — **påkrevd, ikke valgfri.** Verifisert i fase 0: 22
  av 151 grensekanter i 1910-utvalget var ugyldige (reelt overlappende
  polygoner, ikke bare feiljustering — Nederland/Belgia pekte mot Baarle,
  et nettverk av enklaver-i-enklaver). `ST_CoverageSimplify` alene fikk det
  ned til 16; bare `ST_CoverageClean` først fikk det til 0. Krever
  PostGIS 3.6 **og** GEOS 3.14+.
- `ST_AsMVT` — vektorfliser generert i databasen, hvis/når det blir aktuelt

Kostnaden er lav: Spring Boot trenger ny JDBC-driver og dialekt, JPA-koden
er identisk, Hibernate Spatial håndterer geometritypene.

```bash
docker run --name atlas-db -e POSTGRES_PASSWORD=atlas \
  -p 5433:5432 -d postgis/postgis:17-3.6-alpine
```

**Alpine, ikke Debian.** Standard `postgis/postgis:17-3.6` bygges mot
Debian Bullseyes pakkelager, som har GEOS 3.9.0 — låst siden 2021. PostGIS
3.6 *tilbyr* SQL-funksjonene, men det underliggende C-biblioteket er for
gammelt til å levere dem; feilen er eksplisitt: «GEOS version ... doesn't
support ... (3.12.0+ required)». Alpine-varianten bygger mot et ferskere
pakkelager (verifisert GEOS 3.14.1 i fase 0) og løser dette uten
kodeendring — samme PostGIS-API, samme SQL, nyere fundament.

**Port 5433, ikke 5432.** Windows-maskinen har en `postgres.exe` som
kjører som tjeneste og allerede sitter på 5432 (Session 0, ikke synlig i
`docker ps`). Windows tillater to prosesser å binde samme port uten
feilmelding — Docker starter uten klage, men alt som kobler til
`localhost:5432` havner tilfeldig hos den ene eller den andre. Symptomet er
forvirrende: `docker exec` virker alltid (går via lokal socket, aldri
via porten), mens verktøy som kobler til over TCP — `ogr2ogr`, en
fremtidig `application.properties` — kan svare med feil passord uten
at containeren er defekt. **5433 er derfor prosjektets faste vertsport**,
og skal brukes i alle senere `application.properties`- og
docker-compose-oppsett, ikke bare i dette engangsoppsettet.

---

## 4. Backend og API

**Nøkkelinnsikt: dataene er uforanderlige.** 1910 ser aldri annerledes ut.
Ingen brukerinnhold, ingen invalidering. Det former alt.

```
GET /api/v1/borders?date=1910-01-01&bbox=-10,35,30,60&zoom=5
GET /api/v1/sources
```

Returnerer GeoJSON `FeatureCollection`. Hver feature bærer `name`,
`precision`, `validFrom`, `validTo`, `source`.

**Regler:**

- Klienten sender `zoom` (0–18), **ikke** `tolerance`. Serveren regner om og
  klemmer verdien. Ellers kan hvem som helst be om full oppløsning og velte
  databasen.
- La PostGIS lage GeoJSON med `ST_AsGeoJSON`. Ikke serialiser JTS-geometrier
  med Jackson — databasen gjør det raskere, og du slipper et konverteringslag.
- Caching er nesten hele ytelsesstrategien:
  `Cache-Control: public, max-age=31536000, immutable`
- CORS løses med en `CorsConfiguration`-bean, ikke `@CrossOrigin` strødd
  utover kontrollerne.

**Vektorfliser er bevisst utsatt.** De er riktig svar for et globalt atlas,
men passer dårlig med en `date`-parameter — flisemengden multipliseres med
antall årstall og cachetreffene blir dårlige. Den elegante løsningen er
OpenHistoricalMap-tilnærmingen: tidsagnostiske fliser der hvert objekt bærer
sine egne datoer, og klienten filtrerer lokalt. PostGIS holder den døren
åpen gratis.

---

## 5. Frontend

**MapLibre GL JS via CDN. Ingen React, ingen npm, ingen byggesteg.**
Én `index.html` med to `<script>`-tagger.

JavaScript som faktisk trengs: `fetch`, `async`/`await`, `addEventListener`,
og MapLibres API. Fire konsepter.

### Ingen bakgrunnskart — bevisst valg

Alle tutorials peker på en flisleverandør (MapTiler, Stadia, Jawg). Alle
krever API-nøkkel og binder deg til en tredjepart. To grunner til å la være:

1. **Prinsipielt.** Å legge historiske grenser oppå moderne kart er
   misvisende — kystlinjer, elver og innsjøer endrer seg. Grensene fra 1886
   oppå moderne motorveier er ikke bare stygt, det er feil.
2. **Praktisk.** Polygonene *er* kartet. Unionen av alle territorier i år X
   er landmassen i år X. Ingen kystlinjelag nødvendig. Bakgrunnen er
   havfarge.

Resultat: ingen API-nøkkel, ingen kvote, ingen leverandør, raskere lasting.

### Detaljer som betyr noe

- `setTimeout`-debounce på ~120 ms på slideren. Uten den sendes én
  HTTP-forespørsel per piksel du drar.
- Globus er gratis: `projection: { type: "globe" }` i stilobjektet.
  Kom i MapLibre GL JS 5.0.0 (januar 2025).

### Senere, på samme `index.html`

- Vektorfliser med klientside-tidsfiltrering → øyeblikkelig slider
- Stiluttrykk drevet av `precision` → uskarphet på usikre grenser
- Hendelsesmarkører med popups

Ingenting kastes.

---

## 6. Omfang

### Inne i MVP

- Europa, 1886–2019, som **synlig startvisning** — ikke et datafilter.
  Fase 0 bekreftet at CShapes allerede er globalt (710 rader dekker hele
  verden). Filtrere importen på GW-kode 200–399 ville skapt et hull: Det
  osmanske riket (kode 640) kontrollerte Balkan til 1913 og faller utenfor
  det intervallet. Riktig løsning er å importere alt og la `bbox` i API-et
  (seksjon 4) og kartets startposisjon (`center: [10, 50]` i
  `index.html`) gjøre jobben i stedet.
- Slider, kart, land som tegnes om
- Klikk på land → navn (billig i MapLibre, stor opplevd verdi)
- Kildeside som oppfyller attribusjonskravet
- **Deployet på offentlig URL** — dette er definisjonen av ferdig
- README med skjermbilde eller GIF øverst

### Ute — og hvorfor

- **Hendelser (kriger, traktater) og Wikidata.** Et helt eget prosjekt:
  SPARQL, ny datamodell, nytt kartlag, popups. Grenser + slider er én
  sammenhengende leveranse. Halvferdige hendelsesmarkører gjør appen verre,
  ikke bedre. *Ikke lag hendelsestabellen i første migrasjon.*
- **Global visning i frontend.** Dataene er allerede globale (se over) —
  det som er ute av MVP er å *vise* dem globalt. Kartet starter zoomet på
  Europa; å utvide startvisningen er en linje kode i `index.html`, ikke
  et importarbeid.
- **Vektorfliser.** Se Backend.
- **Søk, brukerkontoer, mobiloptimalisering, flerspråklighet.** Ingen av dem
  tjener MVP-setningen.

---

## 7. Tidsløp

**Ikke start med Spring Boot.** Instinktet sier prosjektstruktur i NetBeans
fordi det er hjemmebane og føles produktivt. Den største risikoen er
dataene, og de er uverifiserte.

Enheten under er **kveld** ≈ 3 timer. Estimatene er gjetninger, ikke løfter.
Fase 0 og 3 er de som kan sprekke — begge er ukjent terreng.

Hver fase har en **port**: et konkret kriterium som må være oppfylt før du
går videre. Ikke gå videre uten. Porten er det som hindrer at du bygger
videre på noe som er galt.

| Fase | Innhold | Estimat |
|---|---|---|
| 0 | Datastikket | 1 kveld |
| 1 | Skjema og import | 2–3 kvelder |
| 2 | Backend, ett endepunkt | 2–3 kvelder |
| 3 | Frontend, første kart | 3–5 kvelder |
| 4 | **Deploy** | 1 helg |
| | *MVP live* | *≈ 40–50 t* |
| 5 | Backend-kvalitet | 3–4 kvelder |
| 6 | Polering | 3–4 kvelder |
| | *CV-klar* | *≈ 70 t* |
| 7 | CShapes-Europe | 2–3 kvelder |
| 8+ | Åpent | — |

Ved ~8 timer i uka: **MVP live om 5–7 uker. CV-klar om 10–12.** Regn med
uker der det blir null. Det er greit — planen tåler pauser, fordi hver fase
er avsluttet før den neste begynner.

---

### Fase 0 — Datastikket · gjennomført ✅

Før én linje Java. Brukte mer enn én kveld i praksis — en portkollisjon
mellom Docker og en Windows-tjeneste på 5432 spiste mesteparten av tiden,
ikke selve dataarbeidet.

1. Start PostGIS i Docker (kommando i seksjon 3 — merk port 5433)
2. Last ned CShapes 2.0, Gleditsch og Ward-koding, Shapefile-format
3. Importer med:
   ```bash
   ogr2ogr --config SHAPE_ENCODING ISO-8859-1 \
     -f "PostgreSQL" \
     PG:"host=localhost port=5433 dbname=postgres user=postgres password=atlas" \
     CShapes-2.0.shp \
     -nln cshapes_raw -nlt MULTIPOLYGON -t_srs EPSG:4326 \
     -lco GEOMETRY_NAME=geom -lco FID=id -overwrite
   ```
4. Kjør intervallspørringen for 1910
5. Åpne resultatet i QGIS og **se på det** — *gjenstår, se sjekkliste under*

**Resultat: 710 rader importert**, ingen tapte features.

**Port bestått:**

- ✅ 151 grenseperioder gyldige i 1910 totalt; 22 europeiske stater i
  utvalget (Østerrike-Ungarn, Serbia, Det osmanske riket m.fl. — stater som
  ikke finnes i dag)
- ✅ Polen har ingen rad før `1918-11-11` — intervallmodellen virker: et
  land som ikke fantes har ingen rad, ikke en tom geometri
- ✅ `gwsdate`/`gwedate` ble ekte `date`-kolonner
- ✅ Tegnkoding riktig (`octet_length` > `length` på navn med aksenter,
  verifisert på `Kinshasa (Léopoldville)`)
- ✅ `ST_CoverageInvalidEdges` kjørt — **avdekket et blokkerende
  infrastrukturproblem, nå løst.** Standard `postgis/postgis:17-3.5`
  (Debian) bygger mot GEOS 3.9.0, for gammel til coverage-funksjonene
  (krever 3.12+). Løsning: Alpine-varianten av samme image bygger mot
  et ferskere pakkelager. Deretter: 22 av 151 grensekanter i 1910-utvalget
  var reelt ugyldige (bekreftet overlapp, ikke bare feiljustering — mistenkt
  Baarle-enklavene). `ST_CoverageSimplify` alene reduserte det til 16;
  `ST_CoverageClean` (krever PostGIS 3.6 **og** GEOS 3.14+, testet med
  Alpine-varianten av 3.6) fikk det til 0. Se seksjon 3 og Risiko 1 for
  full pipeline og begrunnelse.
- ✅ Visuell kontroll i QGIS bestått. Østerrike-Ungarn ett sammenhengende
  område, Norge/Sverige-grensen riktig plassert, ingen Polen (korrekt for
  1910), kystlinjen umiskjennelig Europa. Hvite felt i Østersjøen/
  Middelhavet er forventet (ingen basemap, hav = bakgrunn). Små hull rundt
  enkelte greske øyer notert som noe å se nærmere på i fase 1, ikke
  blokkerende.

**Fase 0 er komplett.** Alle fem verifiseringspunktene bestått.

Tre funn som endrer planen, alle innarbeidet andre steder i dette
dokumentet: `gwedate` er inklusiv (se seksjon 2), CShapes er allerede
globalt så «Europa» er en visning, ikke et importfilter (se seksjon 6), og
databasen skal være `postgis/postgis:17-3.6-alpine`, ikke standard
Debian-image (se seksjon 3 og Risiko 1).

Konklusjonen står likevel: **hele prosjektet er de-risket.** Det eneste som
faktisk var galt var to servere på én port og et manglende kodesideflagg —
ingenting i selve arkitekturen eller datamodellen.

### Fase 1 — Skjema og import · 2–3 kvelder

- Flyway-migrasjon med de tre tabellene
- Importskript: rå CShapes → staging-tabell → normalisert modell
- Fyll `data_source` med lisens og attribusjon nå, ikke senere
- Forhåndsberegn 3–4 forenklingsnivåer med `ST_CoverageSimplify`
  (se Risiko 1)

**Port:** Spørringen returnerer riktig antall land for to årstall du har
sjekket manuelt. Forslag: 1910 og 1925 — Polen skal finnes i det ene og
ikke i det andre.

### Fase 2 — Backend, ett endepunkt · 2–3 kvelder

- Spring Boot-prosjekt, PostgreSQL-driver, Hibernate Spatial
- `GET /api/v1/borders` med `ST_AsGeoJSON`
- `zoom` → `tolerance`-mapping, med klemming
- Ikke bygg `/sources` ennå

**Port:** `curl` returnerer gyldig GeoJSON for 1910. Lim responsen inn i
geojson.io og se at det er Europa.

### Fase 3 — Frontend, første kart · 3–5 kvelder ⚠

Den usikreste fasen. Du har ikke skrevet JavaScript før, og estimatet er
tilsvarende løst. Hvis noe skal sprekke, sprekker det her.

- `index.html` fra seksjon 5
- CORS-bean i Spring
- Debounce på slideren

**Port:** Slideren virker lokalt, og Europa tegnes om.

Blir dette en myr: fall tilbake på Leaflet for MVP. API-et er identisk, så
det koster deg ingenting utenfor denne fila, og MapLibre kan komme i fase 8.
Å bytte er ikke nederlag — å stå fast i tre uker er.

### Fase 4 — Deploy · 1 helg ⭐

**Milepælen.** Stygt er greit. Ingen tester ennå, ingen polering.

- Hosting med PostgreSQL **og PostGIS-utvidelsen** (verifiser dette først —
  se seksjon 10)
- Kjør importen mot prod
- CORS mot prod-domenet
- README med GIF øverst

**Port:** En fremmed kan åpne URL-en på mobilen din og dra slideren.

*Alt etter dette er forbedring av noe som lever.*

### Fase 5 — Backend-kvalitet · 3–4 kvelder

Fasen som faktisk får deg jobb. Se Risiko 3.

- Testcontainers-integrasjonstest: starter PostGIS, verifiserer at
  intervallspørringen gir riktig antall land i 1910
- Enhetstester på `zoom` → `tolerance`
- GitHub Actions: bygg, test, lint
- Docker Compose for hele stacken
- Feilhåndtering og validering av parametre

**Port:** Grønn CI-badge i README, og `docker compose up` starter alt.

### Fase 6 — Polering · 3–4 kvelder

- Klikk på land → navn
- `/api/v1/sources` + kildeside i appen (lisenskravet, seksjon 1)
- Cache-headere
- Farger og typografi som ikke ser ut som en prototype

**Port:** Du er ikke flau over å lenke til den i en søknad.

### Fase 7 — CShapes-Europe · 2–3 kvelder

Den første ekte utvidelsen. Ny importer, samme modell — beviset på at
flerkilde-designet fra seksjon 2 virker.

Belønningen: 1816–1886, tysk og italiensk samling. Kartet der Tyskland
*blir til* av 39 småstater.

**Port:** To kilder i `data_source`, begge korrekt attribuert, ingen
endring i domenemodellen.

### Fase 8+ — Åpent

Ikke planlagt. Kandidater, grovt etter forhold mellom verdi og kostnad:
globus (én linje), stiluttrykk på `precision`, global dekning,
vektorfliser, hendelser og Wikidata.

Ta dem én om gangen, og bare hvis du har lyst. Fra fase 4 er prosjektet
ferdig nok til å vises fram — resten er fordi det er gøy.

---

## 8. Risikoer

### 1. Forenkling lager glipper mellom naboland — teknisk, vil skje

`ST_SimplifyPreserveTopology` bevarer topologi **kun innenfor én geometri.**
Hvert land er sin egen rad. Forenkles Frankrike og Belgia hver for seg, blir
den felles grensen forenklet i to retninger → glipper og overlapp.

JTS-utviklerne er eksplisitte: algoritmen opererer på polygoner, ikke på
polygonale dekninger, og gir hull og overlapp brukt på en dekning.

**Riktig pipeline — verifisert i fase 0, ikke bare antatt:**

```sql
WITH cleaned AS (
  SELECT id, ST_CoverageClean(geom) OVER () AS geom
  FROM territory_version
  WHERE valid_from <= :date AND (valid_to IS NULL OR valid_to > :date)
)
SELECT id, ST_CoverageSimplify(geom, :tolerance) OVER () AS geom
FROM cleaned;
```

`ST_CoverageSimplify` alene er **ikke nok**. Testet mot CShapes' 1910-utvalg
(151 grensekanter): 22 ugyldige kanter i rådataene, `ST_CoverageSimplify`
alene reduserte det til 16, og bare med `ST_CoverageClean` først ble det 0.
De gjenværende 16 var reelt overlappende polygoner (mistenkt: Baarle,
nettverket av nederlandske/belgiske enklaver-i-enklaver) — noe
`ST_CoverageSimplify` forenkler rundt, men aldri retter, fordi den bare
garanterer gyldighet for feiljusterte kanter, ikke ekte overlapp.

`ST_CoverageClean` kom i PostGIS 3.6 og krever **GEOS 3.14+** i tillegg —
en detalj som kostet en egen runde feilsøking, se seksjon 3 (Alpine vs.
Debian-image). `ST_CoverageInvalidEdges` er verifiseringen etterpå; med
riktig image returnerer den 0 ugyldige kanter for hele 1910-utvalget.

Vindusfunksjoner over hele årets datasett er ikke gratis → **forhåndsberegn
noen få forenklingsnivåer ved import**, ikke per forespørsel. Rensesteget
(`ST_CoverageClean`) hører hjemme i importskriptet i fase 1, kjørt én gang
per årstall før forenklingsnivåene beregnes — ikke i den kjørende
API-spørringen.

### 2. Politisk sensitivitet

Historiske grenser er omstridte, og appen er offentlig. Noen vil ha en
mening om Kosovo, Kypros, Irland eller Elsass.

**Forsvaret:** du gjengir CShapes' koding, ikke din egen. Datasettet bygger
på Gleditsch og Ward- eller Correlates of War-listene, med dokumenterte
kriterier. Det er holdbart.

**Forsvaret forsvinner** i det sekundet du håndredigerer én polygon fordi
den «ser feil ut». Da eier du plutselig alle grensene. Endringer gjøres i
importkoden, versjonert i Git, med begrunnelse. Skriv på kildesiden at
grensene gjengis fra kilden uten redaksjonell overstyring.

### 3. Prosjektet blir et GIS-prosjekt i stedet for et backend-prosjekt

Den viktigste risikoen for jobbsøkingen. Kartografi er forførende — tre
måneder på projeksjoner og fargepaletter gir et vakkert kart og et repo som
ikke viser fram det du søker jobb som.

Ingen som ansetter en Java-backendutvikler evaluerer topologihåndteringen.
De ser etter lagdeling, API-design, tester, CI, Docker, feilhåndtering.
De hører hjemme her **fra dag én**, ikke som pålegg til slutt.

Konkret: en integrasjonstest med Testcontainers som starter PostGIS og
verifiserer at intervallspørringen gir riktig antall land i 1910, er verdt
mer enn perfekte kystlinjer. Den viser at du kan teste mot en ekte database.

*Kartet er kroken som får folk til å åpne repoet. Backenden er grunnen til
at de ringer.*

### 4. «Best mulig produkt» — aldri ferdig

Setningen har ingen definisjon av ferdig. Det er slik soloprosjekter dør.

**Motgift:** deploy stygt og tidlig. Så snart slideren virker, legg den ut.
Deretter forbedrer du noe som lever. Et prosjekt som er live etter tre uker
blir ferdig; ett som skal bli bra før det vises fram, blir det sjelden.

---

## 9. Ferdig betyr

- [ ] Deployet URL som virker
- [ ] Slider som virker
- [ ] Europa som tegnes om
- [ ] Kildeside med attribusjon
- [ ] README med skjermbilde eller GIF øverst
- [ ] Tester og CI på plass

En rekrutterer bruker elleve sekunder på GitHub-profilen. En GIF av grenser
som endrer seg fra 1886 til 2019 gjør mer for jobbsøkingen enn de neste 500
linjene med kode.

---

## 10. Åpne spørsmål

- Hvilken hostingløsning? (Gratis PostgreSQL-tier med PostGIS må
  verifiseres — sjekk at utvidelsen faktisk er tilgjengelig, ikke bare
  PostgreSQL.)
- Skal dette dokumentet og README være på engelsk hvis repoet er offentlig?

**Avgjort i fase 0:** Gleditsch og Ward-koding, ikke Correlates of War — GW
er mer inkluderende (tar med småstater som Liechtenstein og San Marino) og
er koblingen `gwcode`/`gwsdate`/`gwedate` faktisk bruker. Bekreftet i felt
og verdier i `cshapes_raw` (f.eks. `gwcode 490` for DR Kongo).