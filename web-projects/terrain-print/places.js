// Points of interest for the terrain 3D-print tool.
// lat: degrees north (negative = south). lon: degrees east, -180..180.
// Moon: selenographic lat/lon. Mars: planetocentric latitude, east longitude (IAU / Mars 2000).
// size: width of the printed area around the point, in km.
// Sources: USGS Gazetteer of Planetary Nomenclature (feature centres and diameters),
// LRO/LROC-derived landing coordinates (Wikipedia, "List of artificial objects on the Moon"),
// NASA/JPL, HiRISE and NSSDCA pages (Mars landers), OpenStreetMap/Wikipedia (Earth).

export const PLACES = {
  moon: [
    { id: "apollo-11", name: "Apollo 11 – Tranquility Base", kind: "landing", lat: 0.6741, lon: 23.4730, size: 40, note: "First crewed landing, 20 July 1969." },
    { id: "apollo-12", name: "Apollo 12 – Ocean of Storms", kind: "landing", lat: -3.0124, lon: -23.4216, size: 40, note: "Pinpoint landing beside the Surveyor 3 probe, November 1969." },
    { id: "apollo-14", name: "Apollo 14 – Fra Mauro", kind: "landing", lat: -3.6453, lon: -17.4714, size: 40, note: "Landed in the Fra Mauro highlands, February 1971." },
    { id: "apollo-15", name: "Apollo 15 – Hadley–Apennine", kind: "landing", lat: 26.1322, lon: 3.6339, size: 50, note: "First Lunar Roving Vehicle, beside Hadley Rille, July 1971." },
    { id: "apollo-16", name: "Apollo 16 – Descartes Highlands", kind: "landing", lat: -8.9730, lon: 15.5002, size: 40, note: "Landed in the Descartes Highlands, April 1972." },
    { id: "apollo-17", name: "Apollo 17 – Taurus–Littrow", kind: "landing", lat: 20.1908, lon: 30.7717, size: 40, note: "Last Apollo landing, December 1972, in the Taurus–Littrow valley." },
    { id: "luna-9", name: "Luna 9", kind: "landing", lat: 7.08, lon: -64.37, size: 60, note: "First soft landing on the Moon, 3 February 1966." },
    { id: "lunokhod-1", name: "Luna 17 / Lunokhod 1", kind: "landing", lat: 38.28, lon: -35.00, size: 50, note: "First robotic rover on another world, landed November 1970." },
    { id: "change-3", name: "Chang'e 3 – Guang Han Gong", kind: "landing", lat: 44.1214, lon: -19.5116, size: 40, note: "China's first Moon landing, with the Yutu rover, December 2013." },
    { id: "change-4", name: "Chang'e 4 – Von Kármán crater", kind: "landing", lat: -45.4561, lon: 177.5885, size: 60, note: "First soft landing on the far side, 3 January 2019." },
    { id: "change-5", name: "Chang'e 5 – Statio Tianchuan", kind: "landing", lat: 43.0576, lon: -51.9161, size: 40, note: "Sample-return lander in Oceanus Procellarum, December 2020." },
    { id: "change-6", name: "Chang'e 6 – Statio Tianjiang", kind: "landing", lat: -41.6385, lon: -153.9852, size: 50, note: "Brought back the first far-side samples, June 2024." },
    { id: "chandrayaan-3", name: "Chandrayaan-3 – Statio Shiv Shakti", kind: "landing", lat: -69.373, lon: 32.319, size: 40, note: "India's first Moon landing, near the south pole, 23 August 2023." },
    { id: "tycho", name: "Tycho", kind: "crater", lat: -43.2958, lon: -11.2153, size: 140, note: "Young crater about 85 km wide with bright rays." },
    { id: "copernicus", name: "Copernicus", kind: "crater", lat: 9.6209, lon: -20.0786, size: 155, note: "Terraced crater about 96 km wide with central peaks." },
    { id: "clavius", name: "Clavius", kind: "crater", lat: -58.6228, lon: -14.7275, size: 370, note: "One of the largest near-side craters, about 231 km wide." },
    { id: "aristarchus", name: "Aristarchus", kind: "crater", lat: 23.7299, lon: -47.4901, size: 65, note: "Very bright crater about 40 km wide." },
    { id: "plato", name: "Plato", kind: "crater", lat: 51.6192, lon: -9.3825, size: 160, note: "Lava-flooded crater about 101 km wide, north of Mare Imbrium." },
    { id: "shackleton", name: "Shackleton (south pole)", kind: "crater", lat: -89.67, lon: 129.78, size: 60, note: "Crater about 21 km wide on the lunar south pole." },
    { id: "south-pole-aitken", name: "South Pole–Aitken basin", kind: "basin", lat: -53, lon: -169, size: 3200, note: "Largest, deepest and oldest basin on the Moon, about 2,500 km wide." },
    { id: "mare-orientale", name: "Mare Orientale", kind: "basin", lat: -19.8655, lon: -94.6703, size: 1500, note: "Bullseye of rings around a young multi-ring impact basin." },
    { id: "mare-imbrium", name: "Mare Imbrium", kind: "sea", lat: 34.7244, lon: -14.9086, size: 1600, note: "Sea of Showers, a lava plain about 1,150 km across." },
    { id: "mare-tranquillitatis", name: "Mare Tranquillitatis", kind: "sea", lat: 8.3487, lon: 30.8346, size: 1100, note: "Sea of Tranquility, where Apollo 11 landed." },
    { id: "mons-huygens", name: "Mons Huygens", kind: "mountain", lat: 19.9188, lon: -2.8571, size: 80, note: "Apennine peak rising about 5.3 km above Mare Imbrium." },
    { id: "selenean-summit", name: "Selenean summit", kind: "mountain", lat: 5.4125, lon: -158.6335, size: 60, note: "Highest point on the Moon, 10,786 m above the lunar mean." },
    { id: "montes-apenninus", name: "Montes Apenninus", kind: "mountain", lat: 19.8714, lon: 0.0253, size: 700, note: "Range about 600 km long on the rim of Mare Imbrium." },
    { id: "vallis-alpes", name: "Vallis Alpes", kind: "canyon", lat: 49.2088, lon: 3.6314, size: 220, note: "Straight valley about 155 km long through the lunar Alps." },
  ],

  mars: [
    { id: "olympus-mons", name: "Olympus Mons", kind: "volcano", lat: 18.6528, lon: -133.8025, size: 900, note: "Tallest volcano on Mars, 21.3 km above datum, 600 km wide." },
    { id: "valles-marineris", name: "Valles Marineris", kind: "canyon", lat: -14.0059, lon: -58.5877, size: 4500, note: "Canyon system over 4,000 km long and up to 7 km deep." },
    { id: "hellas-planitia", name: "Hellas Planitia", kind: "basin", lat: -42.4301, lon: 70.5025, size: 3000, note: "Impact basin 2,300 km wide holding the lowest point on Mars." },
    { id: "gale-crater", name: "Gale crater", kind: "crater", lat: -5.3672, lon: 137.8110, size: 250, note: "Crater 154 km wide around Mount Sharp (Aeolis Mons)." },
    { id: "curiosity", name: "Curiosity – Bradbury Landing", kind: "landing", lat: -4.5894, lon: 137.4417, size: 40, note: "Curiosity landed in Gale crater, 6 August 2012." },
    { id: "perseverance", name: "Perseverance – Octavia E. Butler Landing", kind: "landing", lat: 18.4458, lon: 77.4508, size: 80, note: "Perseverance landed in Jezero crater, 18 February 2021." },
    { id: "opportunity", name: "Opportunity – Eagle crater, Meridiani", kind: "landing", lat: -1.9461, lon: -5.5267, size: 40, note: "Opportunity landed in tiny Eagle crater, 25 January 2004." },
    { id: "spirit", name: "Spirit – Gusev crater", kind: "landing", lat: -14.5717, lon: 175.4786, size: 60, note: "Spirit landed in Gusev crater, 4 January 2004." },
    { id: "viking-1", name: "Viking 1 – Chryse Planitia", kind: "landing", lat: 22.27, lon: -47.95, size: 50, note: "Landed 20 July 1976 and worked for over six years." },
    { id: "viking-2", name: "Viking 2 – Utopia Planitia", kind: "landing", lat: 47.64, lon: 134.29, size: 50, note: "Landed in Utopia Planitia, 3 September 1976." },
    { id: "pathfinder", name: "Mars Pathfinder – Ares Vallis", kind: "landing", lat: 19.33, lon: -33.55, size: 60, note: "Landed 4 July 1997 with Sojourner, the first Mars rover." },
    { id: "phoenix", name: "Phoenix", kind: "landing", lat: 68.22, lon: -125.70, size: 50, note: "Landed near the north pole in 2008 and touched water ice." },
    { id: "insight", name: "InSight – Elysium Planitia", kind: "landing", lat: 4.5025, lon: 135.6233, size: 50, note: "Landed 26 November 2018 to listen for marsquakes." },
    { id: "zhurong", name: "Zhurong – Utopia Planitia", kind: "landing", lat: 25.066, lon: 109.925, size: 50, note: "China's first Mars rover, landed May 2021." },
    { id: "arsia-mons", name: "Arsia Mons", kind: "volcano", lat: -8.2571, lon: -120.0925, size: 650, note: "Southernmost Tharsis Montes volcano, about 475 km wide." },
    { id: "pavonis-mons", name: "Pavonis Mons", kind: "volcano", lat: 1.4801, lon: -112.9624, size: 550, note: "Middle Tharsis Montes volcano, about 375 km wide, near the equator." },
    { id: "ascraeus-mons", name: "Ascraeus Mons", kind: "volcano", lat: 11.9216, lon: -104.0808, size: 650, note: "Tallest Tharsis Montes volcano, over 18 km above datum." },
    { id: "elysium-mons", name: "Elysium Mons", kind: "volcano", lat: 25.0232, lon: 147.2138, size: 550, note: "Volcano about 14.1 km above datum in the Elysium region." },
    { id: "alba-mons", name: "Alba Mons", kind: "volcano", lat: 41.0820, lon: -110.7094, size: 1500, note: "Largest Martian volcano by area, yet only 6.8 km high." },
    { id: "noctis-labyrinthus", name: "Noctis Labyrinthus", kind: "canyon", lat: -6.3625, lon: -101.1889, size: 1400, note: "Maze of steep canyons at the western end of Valles Marineris." },
    { id: "argyre-planitia", name: "Argyre Planitia", kind: "basin", lat: -49.8406, lon: -43.3098, size: 2000, note: "Impact basin about 1,700 km wide, second deepest after Hellas." },
    { id: "planum-boreum", name: "Planum Boreum (north polar cap)", kind: "region", lat: 87.32, lon: 54.96, size: 1400, note: "North polar ice plateau about 1,200 km wide and 3 km thick." },
    { id: "victoria-crater", name: "Victoria crater", kind: "crater", lat: -2.0523, lon: -5.4980, size: 4, note: "Crater under 1 km wide, explored by Opportunity 2006–2008." },
    { id: "huygens-crater", name: "Huygens crater", kind: "crater", lat: -13.8819, lon: 55.5817, size: 750, note: "Impact crater about 467 km wide in the southern highlands." },
  ],

  earth: [
    { id: "everest", name: "Mount Everest", kind: "mountain", lat: 27.9881, lon: 86.9252, size: 40, note: "Highest point on Earth, 8,849 m." },
    { id: "challenger-deep", name: "Challenger Deep (Mariana Trench)", kind: "sea", lat: 11.3733, lon: 142.5917, size: 120, note: "Deepest known point in the ocean, about 10,935 m." },
    { id: "grand-canyon", name: "Grand Canyon", kind: "canyon", lat: 36.10, lon: -112.10, size: 120, note: "Colorado River gorge 446 km long and up to 1,857 m deep." },
    { id: "kilimanjaro", name: "Kilimanjaro", kind: "volcano", lat: -3.0764, lon: 37.3540, size: 60, note: "Highest mountain in Africa, 5,895 m." },
    { id: "mount-fuji", name: "Mount Fuji", kind: "volcano", lat: 35.3628, lon: 138.7308, size: 40, note: "Highest mountain in Japan, 3,776 m." },
    { id: "mont-blanc", name: "Mont Blanc", kind: "mountain", lat: 45.8327, lon: 6.8652, size: 35, note: "Highest peak of the Alps, about 4,806 m." },
    { id: "matterhorn", name: "Matterhorn", kind: "mountain", lat: 45.9764, lon: 7.6586, size: 20, note: "Pyramid-shaped Alpine peak, 4,478 m." },
    { id: "aconcagua", name: "Aconcagua", kind: "mountain", lat: -32.6531, lon: -70.0120, size: 40, note: "Highest mountain in the Americas, 6,961 m." },
    { id: "denali", name: "Denali", kind: "mountain", lat: 63.0691, lon: -151.0062, size: 50, note: "Highest mountain in North America, 6,190 m." },
    { id: "mauna-kea", name: "Mauna Kea (Hawaii)", kind: "volcano", lat: 19.8207, lon: -155.4681, size: 60, note: "4,207 m high, and over 10,000 m from its seafloor base." },
    { id: "mount-st-helens", name: "Mount St. Helens", kind: "volcano", lat: 46.1914, lon: -122.1955, size: 25, note: "Its north side blew out in the eruption of 18 May 1980." },
    { id: "crater-lake", name: "Crater Lake", kind: "crater", lat: 42.9415, lon: -122.0988, size: 20, note: "Deepest lake in the United States, 594 m, in a caldera." },
    { id: "etna", name: "Mount Etna", kind: "volcano", lat: 37.7510, lon: 14.9940, size: 45, note: "One of the world's most active volcanoes, on Sicily." },
    { id: "teide", name: "Teide (Tenerife)", kind: "volcano", lat: 28.2727, lon: -16.6423, size: 30, note: "Highest point in Spain, 3,715 m." },
    { id: "vesuvius", name: "Mount Vesuvius", kind: "volcano", lat: 40.8214, lon: 14.4262, size: 20, note: "Volcano whose eruption buried Pompeii in AD 79." },
    { id: "montserrat", name: "Montserrat (Catalonia)", kind: "mountain", lat: 41.6054, lon: 1.8115, size: 15, note: "Serrated massif; its top, Sant Jeroni, is 1,236 m." },
    { id: "yosemite-valley", name: "Yosemite Valley", kind: "canyon", lat: 37.7327, lon: -119.6057, size: 25, note: "Glacier-carved valley about 12 km long and 1 km deep." },
    { id: "dead-sea", name: "Dead Sea", kind: "sea", lat: 31.5419, lon: 35.4812, size: 90, note: "Its shore is Earth's lowest land, over 430 m below sea level." },
    { id: "iceland", name: "Iceland", kind: "region", lat: 64.96, lon: -19.0, size: 600, note: "Volcanic island sitting on the Mid-Atlantic Ridge." },
    { id: "strait-of-gibraltar", name: "Strait of Gibraltar", kind: "sea", lat: 35.95, lon: -5.64, size: 80, note: "About 13 km wide at its narrowest, between Europe and Africa." },
    { id: "ngorongoro", name: "Ngorongoro Crater", kind: "crater", lat: -3.1766, lon: 35.5788, size: 35, note: "Large intact volcanic caldera, about 610 m deep." },
    { id: "table-mountain", name: "Table Mountain", kind: "mountain", lat: -33.9668, lon: 18.4256, size: 20, note: "Flat-topped mountain above Cape Town, about 1,085 m high." },
    { id: "torres-del-paine", name: "Torres del Paine", kind: "mountain", lat: -50.97, lon: -73.04, size: 40, note: "Granite towers; nearby Cerro Paine Grande reaches 2,884 m." },
    { id: "netherlands", name: "The Netherlands", kind: "region", lat: 52.15, lon: 5.30, size: 350, note: "About a quarter of the country lies below sea level." },
    { id: "florida", name: "Florida peninsula", kind: "region", lat: 27.80, lon: -81.60, size: 750, note: "Low-lying state whose highest point is only 105 m." },
  ],
};

// Proposed ancient ocean shorelines on Mars, elevation in metres relative to the MOLA datum.
export const MARS_SHORELINES = [
  {
    id: "deuteronilus",
    name: "Deuteronilus shoreline (Contact 2)",
    elevation: -3760,
    source: "Head et al. 1999, Science 286:2134",
    note: "Mean of Contact 2 (std. dev. 0.56 km); Carr & Head 2003 give -3792 ± 236 m.",
  },
  {
    id: "arabia",
    name: "Arabia shoreline (Contact 1)",
    elevation: -2090,
    source: "Carr & Head 2003, JGR 108(E5):5042",
    note: "Mean -2090 ± 1400 m; it varies by ~5.6 km, so it is far from level.",
  },
];

// Sea-level presets for Earth, in metres relative to today's mean sea level.
export const EARTH_SEA_PRESETS = [
  { id: "today", name: "Today", elevation: 0 },
  {
    id: "last-glacial-maximum",
    name: "Last Glacial Maximum",
    elevation: -125,
    note: "About 20,000 years ago sea level was about 125 m lower (USGS).",
  },
  {
    id: "all-ice-melted",
    name: "All land ice melted",
    elevation: 70,
    note: "If all glaciers and ice sheets melted, seas would rise about 70 m (USGS).",
  },
];
