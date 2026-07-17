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

Borders are rendered as coded in the source dataset, without editorial
overrides. Any corrections happen in versioned import code with a stated
rationale, never by hand-editing polygons.

Derived data in this repository (e.g. `frontend/landmass.geojson`, the union
of all CShapes territories across time) is shared under the same
CC BY-NC-SA 4.0 license.
