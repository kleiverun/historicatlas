// [Feature 8] Guided stories: curated sequences of (year, camera,
// text) that walk the map through a historical episode. Driven by the
// globals app.js sets up (map, setYear, stopPlayback).
//
// To remove this feature: delete this file and the [Feature 8] blocks
// in index.html. Nothing else references it.

const STORIES = [
  {
    title: "The Collapse of Empires",
    subtitle: "1914–1923",
    steps: [
      {
        year: 1914, center: [22, 48], zoom: 3.2,
        text: "On the eve of the First World War, four empires dominate this part of the map: Germany, Austria-Hungary, Russia, and the Ottoman Empire. Between them they rule most of Central and Eastern Europe and the Near East."
      },
      {
        year: 1918, center: [22, 48], zoom: 3.2,
        text: "November 1918: the war ends with all four empires defeated or collapsing. Austria-Hungary has already begun to dissolve; revolution has taken Russia out of the war a year earlier."
      },
      {
        year: 1920, center: [22, 50], zoom: 3.4,
        text: "The peace treaties redraw the map. Poland returns after 123 years of partition. Czechoslovakia and Hungary emerge from Austria-Hungary; Yugoslavia unites Serbia with former Habsburg lands; Finland, Estonia, Latvia, and Lithuania break from Russia."
      },
      {
        year: 1923, center: [32, 39], zoom: 3.6,
        text: "The last empire falls: after defeat, occupation, and a war of independence, the Ottoman Empire is replaced by the Republic of Turkey in 1923 — the map of Europe and the Near East now looks recognizably modern."
      }
    ]
  },
  {
    title: "Decolonization of Africa",
    subtitle: "1957–1975",
    steps: [
      {
        year: 1957, center: [10, 5], zoom: 2.8,
        text: "In 1957 nearly the whole of Africa is ruled from Europe. Ghana wins independence from Britain — widely seen as the start of the decolonization wave that will sweep the continent."
      },
      {
        year: 1960, center: [15, 10], zoom: 2.8,
        text: "1960, the 'Year of Africa': seventeen states gain independence in a single year, most of them former French colonies across West and Central Africa. Watch the map fill with new names."
      },
      {
        year: 1962, center: [3, 30], zoom: 3.2,
        text: "Algeria wins independence from France in 1962 after an eight-year war — one of the longest and bloodiest decolonization conflicts."
      },
      {
        year: 1975, center: [20, -10], zoom: 2.8,
        text: "Portugal is the last major colonial empire to dissolve: Angola and Mozambique become independent in 1975. A few holdouts remain — white-minority rule in Rhodesia lasts until 1980, and Namibia waits until 1990."
      }
    ]
  },
  {
    title: "The End of the Soviet Union",
    subtitle: "1989–1993",
    steps: [
      {
        year: 1989, center: [30, 55], zoom: 3.0,
        text: "In 1989 the Soviet Union still stretches from the Baltic to the Pacific, with Eastern Europe in its orbit. That year the Berlin Wall falls and the bloc begins to loosen."
      },
      {
        year: 1991, center: [40, 55], zoom: 2.8,
        text: "December 1991: the Soviet Union dissolves into fifteen independent republics — from Estonia in the west to Kazakhstan and the Central Asian states in the south. The largest country on the map changes shape overnight."
      },
      {
        year: 1992, center: [19, 44], zoom: 4.0,
        text: "The breakup spreads: Yugoslavia splinters into Slovenia, Croatia, Bosnia and Herzegovina, and the rest — the start of a decade of wars in the Balkans."
      },
      {
        year: 1993, center: [17, 49], zoom: 4.2,
        text: "Czechoslovakia takes the peaceful road: on 1 January 1993 it splits into the Czech Republic and Slovakia — the 'Velvet Divorce'. The post-Cold-War map of Europe is complete."
      }
    ]
  }
];

(function () {
  const button = document.getElementById("stories-btn");
  const panel = document.getElementById("story-panel");
  const card = document.getElementById("story-card");
  const cardTitle = document.getElementById("story-card-title");
  const cardText = document.getElementById("story-card-text");
  const progress = document.getElementById("story-progress");
  const prevBtn = document.getElementById("story-prev");
  const nextBtn = document.getElementById("story-next");
  const exitBtn = document.getElementById("story-exit");

  let story = null;
  let stepIndex = 0;

  for (const s of STORIES) {
    const item = document.createElement("button");
    item.className = "story-item";
    item.innerHTML = `<span class="story-item-title"></span><span class="story-item-sub"></span>`;
    item.querySelector(".story-item-title").textContent = s.title;
    item.querySelector(".story-item-sub").textContent = s.subtitle;
    item.addEventListener("click", () => start(s));
    panel.appendChild(item);
  }

  function start(s) {
    panel.hidden = true;
    story = s;
    stepIndex = 0;
    showStep();
  }

  function exit() {
    story = null;
    card.hidden = true;
  }

  function showStep() {
    const step = story.steps[stepIndex];
    stopPlayback();
    setYear(step.year);
    map.flyTo({ center: step.center, zoom: step.zoom, duration: 1600 });
    cardTitle.textContent = story.title + " · " + step.year;
    cardText.textContent = step.text;
    progress.textContent = (stepIndex + 1) + " / " + story.steps.length;
    prevBtn.disabled = stepIndex === 0;
    nextBtn.textContent = stepIndex === story.steps.length - 1 ? "Finish" : "Next ›";
    card.hidden = false;
  }

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });
  prevBtn.addEventListener("click", () => {
    stepIndex--;
    showStep();
  });
  nextBtn.addEventListener("click", () => {
    if (stepIndex >= story.steps.length - 1) {
      exit();
    } else {
      stepIndex++;
      showStep();
    }
  });
  exitBtn.addEventListener("click", exit);
  // Clicking anywhere on the map closes the story list (not an active story)
  document.getElementById("map").addEventListener("click", () => {
    panel.hidden = true;
  });
})();
