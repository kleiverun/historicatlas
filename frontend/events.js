// [Feature 9] Event markers: curated historical events pinned to the
// map for the year the slider shows. Click a marker for a short note.
//
// To remove this feature: delete this file, the script tag in
// index.html, and the [Feature 9] block in app.js.
//
// One entry per event: { year, lngLat: [lng, lat], title, text }.
// Extend freely -- anything with a year in the dataset range and a
// place on the map belongs here.

const EVENTS = [
  { year: 1896, lngLat: [23.73, 37.98], title: "First modern Olympics", text: "Athens hosts the first Olympic Games of the modern era." },
  { year: 1898, lngLat: [-79.5, 21.5], title: "Spanish–American War", text: "The war ends Spain's colonial empire: the US takes Puerto Rico, Guam, and the Philippines, and Cuba comes under American oversight." },
  { year: 1899, lngLat: [24.0, -29.0], title: "Boer War begins", text: "Britain fights the Boer republics for control of southern Africa.", wiki: "Second Boer War" },
  { year: 1904, lngLat: [121.2, 38.8], title: "Russo-Japanese War", text: "Japan attacks the Russian fleet at Port Arthur; its victory in 1905 is the first modern defeat of a European power by an Asian one." },
  { year: 1905, lngLat: [10.75, 59.91], title: "Norway becomes independent", text: "The union with Sweden is dissolved peacefully after a referendum; Norway chooses its own king.", wiki: "Dissolution of the union between Norway and Sweden" },
  { year: 1908, lngLat: [18.42, 43.86], title: "Bosnia annexed", text: "Austria-Hungary annexes Bosnia and Herzegovina, deepening the crisis in the Balkans.", wiki: "Bosnian Crisis" },
  { year: 1912, lngLat: [21.43, 41.99], title: "First Balkan War", text: "Serbia, Bulgaria, Greece, and Montenegro drive the Ottoman Empire out of almost all of Europe." },
  { year: 1914, lngLat: [18.41, 43.86], title: "Assassination in Sarajevo", text: "Archduke Franz Ferdinand is shot on 28 June; within weeks Europe is at war." },
  { year: 1916, lngLat: [2.7, 50.0], title: "Battle of the Somme", text: "Over a million men are killed or wounded in one of history's bloodiest battles." },
  { year: 1917, lngLat: [30.31, 59.94], title: "Russian Revolution", text: "The Bolsheviks seize power in Petrograd; Russia leaves the war and civil war follows." },
  { year: 1918, lngLat: [2.9, 49.43], title: "Armistice", text: "Germany signs the armistice in a railway carriage at Compiègne on 11 November.", wiki: "Armistice of 11 November 1918" },
  { year: 1919, lngLat: [2.13, 48.8], title: "Treaty of Versailles", text: "The peace treaty redraws the map of Europe and assigns Germany responsibility for the war." },
  { year: 1920, lngLat: [6.15, 46.2], title: "League of Nations", text: "The first worldwide organization for peace opens in Geneva — without the United States." },
  { year: 1922, lngLat: [37.62, 55.75], title: "USSR founded", text: "The Soviet Union is formally established, uniting Russia with the republics won in the civil war.", wiki: "Soviet Union" },
  { year: 1929, lngLat: [-74.01, 40.71], title: "Wall Street Crash", text: "The New York stock market collapses, setting off the worldwide Great Depression." },
  { year: 1933, lngLat: [13.38, 52.52], title: "Hitler takes power", text: "Adolf Hitler is appointed Chancellor of Germany; the Weimar Republic gives way to dictatorship.", wiki: "Adolf Hitler's rise to power" },
  { year: 1936, lngLat: [-3.7, 40.42], title: "Spanish Civil War", text: "A military uprising against the republic begins three years of war that Franco will win." },
  { year: 1939, lngLat: [18.67, 54.41], title: "Invasion of Poland", text: "Germany attacks Poland on 1 September; Britain and France declare war. The Second World War begins." },
  { year: 1940, lngLat: [-0.13, 51.51], title: "Battle of Britain", text: "The RAF turns back the Luftwaffe in the first battle fought entirely in the air." },
  { year: 1941, lngLat: [-157.95, 21.36], title: "Pearl Harbor", text: "Japan attacks the US Pacific fleet; the United States enters the war." },
  { year: 1942, lngLat: [44.5, 48.7], title: "Stalingrad", text: "The German advance is broken in the ruins of Stalingrad — the turning point of the war in Europe.", wiki: "Battle of Stalingrad" },
  { year: 1944, lngLat: [-0.6, 49.34], title: "D-Day", text: "Allied forces land in Normandy on 6 June, opening the western front." },
  { year: 1945, lngLat: [132.45, 34.39], title: "Hiroshima", text: "The first atomic bomb is dropped on 6 August; Japan surrenders and the war ends.", wiki: "Atomic bombings of Hiroshima and Nagasaki" },
  { year: 1947, lngLat: [77.21, 28.61], title: "Indian independence", text: "British India is partitioned into India and Pakistan — the largest migration in history follows." },
  { year: 1948, lngLat: [34.78, 32.07], title: "State of Israel", text: "Israel declares independence; war with its Arab neighbours begins the next day." },
  { year: 1949, lngLat: [116.4, 39.9], title: "People's Republic of China", text: "Mao Zedong proclaims the People's Republic after victory in the civil war." },
  { year: 1950, lngLat: [127.0, 37.55], title: "Korean War", text: "North Korea invades the South; the war ends in 1953 with the peninsula still divided." },
  { year: 1956, lngLat: [19.04, 47.5], title: "Hungarian Uprising", text: "A revolt against Soviet rule is crushed by the Red Army; over 200,000 flee." },
  { year: 1957, lngLat: [12.48, 41.9], title: "Treaty of Rome", text: "Six countries found the European Economic Community — the seed of today's EU." },
  { year: 1960, lngLat: [15.31, -4.32], title: "Congo independence", text: "The Belgian Congo becomes independent — one of seventeen African states born this year.", wiki: "Congo Crisis" },
  { year: 1961, lngLat: [13.4, 52.52], title: "Berlin Wall built", text: "East Germany seals the border overnight; the wall will divide the city for 28 years.", wiki: "Berlin Wall" },
  { year: 1962, lngLat: [-77.0, 22.0], title: "Cuban Missile Crisis", text: "Soviet missiles on Cuba bring the world to the edge of nuclear war for thirteen days." },
  { year: 1967, lngLat: [35.22, 31.78], title: "Six-Day War", text: "Israel defeats Egypt, Jordan, and Syria, occupying Sinai, the West Bank, and the Golan Heights." },
  { year: 1969, lngLat: [-80.6, 28.4], title: "Apollo 11", text: "Launched from Cape Canaveral, the first crewed mission lands on the Moon on 20 July." },
  { year: 1975, lngLat: [106.7, 10.78], title: "Fall of Saigon", text: "North Vietnamese forces take Saigon; the Vietnam War ends with reunification under Hanoi." },
  { year: 1979, lngLat: [51.42, 35.69], title: "Iranian Revolution", text: "The Shah is overthrown and an Islamic republic proclaimed under Ayatollah Khomeini." },
  { year: 1980, lngLat: [18.65, 54.35], title: "Solidarity", text: "Workers at the Gdańsk shipyard win the right to a free trade union — the first in the Soviet bloc.", wiki: "Solidarity (Polish trade union)" },
  { year: 1986, lngLat: [30.1, 51.39], title: "Chernobyl", text: "Reactor 4 explodes in the worst nuclear accident in history; fallout spreads across Europe.", wiki: "Chernobyl disaster" },
  { year: 1989, lngLat: [13.4, 52.52], title: "Fall of the Berlin Wall", text: "On 9 November the border opens; within a year Germany is reunified." },
  { year: 1990, lngLat: [18.42, -33.92], title: "Mandela freed", text: "Nelson Mandela walks free after 27 years; apartheid begins its final unravelling.", wiki: "Nelson Mandela" },
  { year: 1991, lngLat: [37.62, 55.75], title: "Dissolution of the USSR", text: "The Soviet flag is lowered over the Kremlin on 25 December; fifteen republics go their own ways." },
  { year: 1994, lngLat: [30.06, -1.94], title: "Rwandan genocide", text: "Around 800,000 people are murdered in a hundred days while the world stands by." },
  { year: 2001, lngLat: [-74.01, 40.71], title: "September 11 attacks", text: "Hijacked airliners destroy the World Trade Center; the 'war on terror' reshapes the following decades." },
  { year: 2004, lngLat: [4.35, 50.85], title: "EU eastern enlargement", text: "Ten countries join the European Union — the largest expansion in its history.", wiki: "2004 enlargement of the European Union" },
  { year: 2011, lngLat: [10.18, 36.8], title: "Arab Spring", text: "Protests that began in Tunisia in late 2010 topple rulers across North Africa and the Middle East." },
  { year: 2014, lngLat: [34.1, 44.95], title: "Crimea annexed", text: "Russia annexes Crimea from Ukraine — the first annexation of another state's territory in Europe since the Second World War.", wiki: "Annexation of Crimea by the Russian Federation" },
  { year: 2016, lngLat: [-0.13, 51.51], title: "Brexit referendum", text: "The United Kingdom votes to leave the European Union." }
];

(function () {
  const EMPTY_FC = { type: "FeatureCollection", features: [] };
  let eventPopup = null;

  function featuresForYear(year) {
    return {
      type: "FeatureCollection",
      features: EVENTS.filter((e) => e.year === year).map((e) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: e.lngLat },
        properties: { title: e.title, text: e.text, year: e.year, wiki: e.wiki || "" }
      }))
    };
  }

  // Called from loadYear() in app.js after each data load.
  window.updateEventMarkers = function (year) {
    if (map.getSource("events")) {
      map.getSource("events").setData(featuresForYear(year));
    }
  };

  map.on("load", () => {
    map.addSource("events", { type: "geojson", data: EMPTY_FC });
    // Soft halo behind the marker so it stands out against any
    // country color; the halo breathes to draw the eye.
    map.addLayer({
      id: "event-halo",
      type: "circle",
      source: "events",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 13, 6, 18],
        "circle-color": "#c0392b",
        "circle-opacity": 0.25
      }
    });
    map.addLayer({
      id: "event-markers",
      type: "circle",
      source: "events",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 7, 6, 10],
        "circle-color": "#c0392b",
        "circle-stroke-color": "#faf7f1",
        "circle-stroke-width": 2.5
      }
    });
    // Gentle pulse on the halo (opacity only -- cheap on the GPU).
    let pulseUp = false;
    setInterval(() => {
      if (!map.getLayer("event-halo")) {
        return;
      }
      pulseUp = !pulseUp;
      map.setPaintProperty("event-halo", "circle-opacity", pulseUp ? 0.38 : 0.18);
      map.setPaintProperty("event-halo", "circle-opacity-transition", { duration: 900 });
    }, 1000);

    map.on("click", "event-markers", (event) => {
      // Reading the popup takes longer than a playback tick -- clicking
      // a marker pauses the slider so the year doesn't move on.
      if (typeof stopPlayback === "function") {
        stopPlayback();
      }
      const props = event.features[0].properties;
      if (eventPopup) {
        eventPopup.remove();
      }
      const name = document.createElement("div");
      name.className = "popup-name";
      name.textContent = props.year + " — " + props.title;
      const meta = document.createElement("div");
      meta.className = "popup-meta";
      meta.textContent = props.text;
      // An explicit `wiki` field names the exact article (needed where
      // the title alone lands on the wrong page, e.g. "Solidarity").
      // Otherwise the search page finds the article from the title.
      const link = document.createElement("a");
      link.className = "popup-link";
      link.href = props.wiki
        ? "https://en.wikipedia.org/wiki/" + encodeURIComponent(props.wiki)
        : "https://en.wikipedia.org/wiki/Special:Search?search="
          + encodeURIComponent(props.title);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Read more on Wikipedia ↗";
      const container = document.createElement("div");
      container.append(name, meta, link);
      eventPopup = new maplibregl.Popup({ closeButton: false, maxWidth: "300px" })
        .setLngLat(event.features[0].geometry.coordinates)
        .setDOMContent(container)
        .addTo(map);
      // Don't let the click fall through to the country beneath.
      event.originalEvent.stopPropagation();
    });
    map.on("mouseenter", "event-markers", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "event-markers", () => {
      map.getCanvas().style.cursor = "";
    });
  });
})();
