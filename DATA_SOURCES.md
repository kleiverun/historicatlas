# Data sources

The same information is exposed at runtime by `GET /api/v1/sources` and
on the Sources page in the app, both backed by the `data_source` table.

## CShapes 2.0

- **Publisher:** International Conflict Research group, ETH Zürich
- **URL:** https://icr.ethz.ch/data/cshapes/
- **License:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — attribution required, non-commercial use only, derivatives must be shared under the same license
- **Coverage:** Borders and capitals of independent states and dependent territories worldwide, 1886–2019, with valid-from/valid-to dates per polygon
- **Coding:** Gleditsch & Ward state list

**Citation:**

> Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils
> Weidmann and Kristian Skrede Gleditsch. 2022. "Mapping The International
> System, 1886-2017: The CShapes 2.0 Dataset." *Journal of Conflict
> Resolution* 66(1): 144–61.

## CShapes-Europe

- **Publisher:** International Conflict Research group, ETH Zürich
- **URL:** https://icr.ethz.ch/data/cshapes/
- **License:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — attribution required, non-commercial use only, derivatives must be shared under the same license
- **Coverage:** European state borders from 1816, including the pre-unification German and Italian microstates. In this project the data is clipped to 1816–1885 inclusive; CShapes 2.0 owns everything from 1886-01-01, so each polity has exactly one source per day.
- **Coding:** Gleditsch & Ward state list (shared with CShapes 2.0, which is what lets both sources feed the same `polity` table)

**Citation:**

> Cederman, Lars-Erik, Luc Girardin, Carl Müller-Crepon and Yannick
> Pengl. 2025. "Nationalism and the Transformation of the State: Border
> Change and Political Violence in the Modern World." Cambridge
> University Press.

Borders are rendered as coded in the source dataset, without editorial
overrides. Any corrections happen in versioned import code with a stated
rationale, never by hand-editing polygons.

Derived data in this repository (e.g. `frontend/landmass.geojson`, the union
of all CShapes territories across time) is shared under the same
CC BY-NC-SA 4.0 license.
