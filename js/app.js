const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
  preferCanvas: true,
}).setView([19.1323, 72.9153], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const layerGroups = {
  plants: L.layerGroup().addTo(map),
  trees: L.layerGroup().addTo(map),
  turf: L.layerGroup().addTo(map),
  parcel: L.layerGroup().addTo(map),
};

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const searchToggle = document.getElementById("searchToggle");
const layersToggle = document.getElementById("layersToggle");
const clearSearch = document.getElementById("clearSearch");
const layerPanel = document.getElementById("layerPanel");
const searchPanel = document.getElementById("searchPanel");
const infoPanel = document.getElementById("infoPanel");
const closeInfo = document.getElementById("closeInfo");
const closeLayers = document.getElementById("closeLayers");
const mobileLayers = document.getElementById("mobileLayers");
const mobileSearch = document.getElementById("mobileSearch");
const mobileInfo = document.getElementById("mobileInfo");

const infoType = document.getElementById("infoType");
const infoTitle = document.getElementById("infoTitle");
const infoContent = document.getElementById("infoContent");

const layerCheckboxes = {
  plants: document.getElementById("togglePlants"),
  trees: document.getElementById("toggleTrees"),
  turf: document.getElementById("toggleTurf"),
  parcel: document.getElementById("toggleParcel"),
};

const counts = {
  plants: document.getElementById("plantCount"),
  trees: document.getElementById("treeCount"),
  turf: document.getElementById("turfCount"),
};

const featureIndex = [];

const typeLabelMap = {
  plants: "Plant",
  trees: "Tree",
  turf: "Turf",
  parcel: "Parcel",
};

function setMobileInfoOpen(open) {
  infoPanel.classList.toggle("mobile-open", open);
}

function toggleSearchPanel(force) {
  const shouldOpen =
    typeof force === "boolean"
      ? force
      : searchPanel.classList.contains("hidden");
  searchPanel.classList.toggle("hidden", !shouldOpen);
  if (shouldOpen && !layerPanel.classList.contains("hidden")) {
    layerPanel.classList.add("hidden");
  }
}

function toggleLayerPanel(force) {
  const shouldOpen =
    typeof force === "boolean"
      ? force
      : layerPanel.classList.contains("hidden");
  layerPanel.classList.toggle("hidden", !shouldOpen);
  if (shouldOpen && !searchPanel.classList.contains("hidden")) {
    searchPanel.classList.add("hidden");
  }
}

function safeText(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function resolveFeatureTitle(feature, type) {
  const props = feature.properties || {};
  if (type === "plants") {
    return `Plant ${safeText(props.Plant_id || props.plant_id || props.id || props.Count)}`;
  }
  if (type === "trees") {
    return `Tree ${safeText(props.Tree_id || props.tree_id || props.id || props.Count)}`;
  }
  if (type === "turf") {
    return `Turf ${safeText(props.turd_id || props.turf_id || props.id || props.Count)}`;
  }
  return `Parcel ${safeText(props.Parcel_No || props.ParcelNo || props.ParcelName || props.id || props.fid)}`;
}

function getFeatureSubtitle(feature, type) {
  const props = feature.properties || {};
  if (type === "plants") {
    return safeText(
      props.botanical_name || props.comman_name || props.species || props.type,
    );
  }
  if (type === "trees") {
    return safeText(
      props.botanical_name || props.comman_name || props.Type || props.species,
    );
  }
  if (type === "turf") {
    return safeText(
      props.Species || props.type || props.Zone_Name || props["Parcel_No."],
    );
  }
  return safeText(
    props.Zone ||
      props.Zone_Name ||
      props.ParcelName ||
      props.Status ||
      props.type,
  );
}

function getFeatureImageCandidates(feature, type) {
  const props = feature.properties || {};
  const folderMap = {
    plants: "plants",
    trees: "trees",
    turf: "turf",
    parcel: "parcel",
  };

  const folder = folderMap[type] || "features";
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (value) => {
    if (!value) {
      return;
    }
    const cleaned = String(value).trim();
    if (!cleaned || seen.has(cleaned)) {
      return;
    }
    seen.add(cleaned);
    candidates.push(cleaned);
  };

  Object.keys(props).forEach((key) => {
    const lower = key.toLowerCase();
    if (
      [
        "image",
        "image_url",
        "photo",
        "photo_url",
        "img",
        "imagepath",
        "image_file",
        "picture",
        "source_image",
      ].includes(lower)
    ) {
      pushCandidate(props[key]);
    }
  });

  const numberKey = Object.keys(props).find((key) =>
    /image[_ -]?no|image_no|imageid|photo[_ -]?no/i.test(key),
  );
  if (
    numberKey &&
    props[numberKey] !== undefined &&
    props[numberKey] !== null &&
    props[numberKey] !== ""
  ) {
    pushCandidate(props[numberKey]);
  }

  const rootCandidates = [
    "./images/" + folder + "/{value}",
    "images/" + folder + "/{value}",
    "./data/images/" + folder + "/{value}",
    "data/images/" + folder + "/{value}",
  ];

  if (
    typeof props.image_no !== "undefined" ||
    typeof props.Image_No !== "undefined"
  ) {
    const value = props.image_no ?? props.Image_No ?? props["image_no"];
    if (value !== null && value !== undefined && value !== "") {
      rootCandidates.forEach((template) => {
        pushCandidate(template.replace("{value}", value));
      });
    }
  }

  const imageFields = [
    "image",
    "image_url",
    "photo",
    "photo_url",
    "img",
    "picture",
    "image_file",
  ];
  imageFields.forEach((field) => {
    const value =
      props[field] ??
      props[field.toUpperCase()] ??
      props[field.charAt(0).toUpperCase() + field.slice(1)];
    if (value) {
      rootCandidates.forEach((template) => {
        pushCandidate(template.replace("{value}", encodeURIComponent(value)));
      });
    }
  });

  if (!candidates.length) {
    const fallbackValue = `${folder}/feature-${safeText(
      props.id ||
        props.Plant_id ||
        props.Tree_id ||
        props.turd_id ||
        props.fid ||
        "",
    )
      .replace(/\s+/g, "-")
      .toLowerCase()}`;
    rootCandidates.forEach((template) => {
      pushCandidate(template.replace("{value}", fallbackValue));
    });
  }

  return candidates;
}

function resolveFeatureImage(feature, type) {
  const candidates = getFeatureImageCandidates(feature, type);
  const extensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmed)) {
      return trimmed;
    }
    for (const ext of extensions) {
      const full = trimmed.endsWith(ext) ? trimmed : `${trimmed}${ext}`;
      if (full !== trimmed) {
        return full;
      }
    }
  }

  return null;
}

function formatAttributeList(feature, type) {
  const props = feature.properties || {};
  const ignored = new Set([
    "image",
    "image_url",
    "photo",
    "photo_url",
    "img",
    "picture",
    "image_file",
    "image_no",
    "Image_No",
    "Frame_No",
    "type",
    "geometry",
    "Geo-Cordinates",
    "GeoCordinates",
    "latitude",
    "longitude",
  ]);

  return Object.entries(props)
    .filter(
      ([key, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !ignored.has(key) &&
        !ignored.has(key.toLowerCase()),
    )
    .sort(([a], [b]) => a.localeCompare(b));
}

function renderInfoPanel(feature, type) {
  const props = feature.properties || {};
  const title = resolveFeatureTitle(feature, type);
  const subtitle = getFeatureSubtitle(feature, type);
  const imageUrl = resolveFeatureImage(feature, type);

  infoType.textContent = typeLabelMap[type] || "Feature";
  infoTitle.textContent = title;

  const rows = formatAttributeList(feature, type);

  const imageMarkup = imageUrl
    ? `<img src="${imageUrl}" alt="${title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"> <div class="feature-image-placeholder" style="display:none;">No image available</div>`
    : `<div class="feature-image-placeholder">No image available</div>`;

  const attributeMarkup = rows.length
    ? rows
        .map(
          ([key, value]) => `
            <div class="attribute-row">
                <div class="attribute-name">${safeText(key).replace(/_/g, " ")}</div>
                <div class="attribute-value">${safeText(value)}</div>
            </div>
        `,
        )
        .join("")
    : '<div class="attribute-row"><div class="attribute-name">Details</div><div class="attribute-value">No additional metadata available.</div></div>';

  infoContent.innerHTML = `
        <div class="feature-hero">
            ${imageMarkup}
        </div>
        <div class="feature-summary">
            <strong>${title}</strong>
            <span>${subtitle}</span>
        </div>
        <dl class="attribute-list">
            ${attributeMarkup}
        </dl>
    `;

  setMobileInfoOpen(true);
}

function updateFeatureCounts() {
  counts.plants.textContent = featureIndex.filter(
    (item) => item.type === "plants",
  ).length;
  counts.trees.textContent = featureIndex.filter(
    (item) => item.type === "trees",
  ).length;
  counts.turf.textContent = featureIndex.filter(
    (item) => item.type === "turf",
  ).length;
}

function refreshLayerVisibility() {
  Object.entries(layerCheckboxes).forEach(([type, checkbox]) => {
    const visible = checkbox.checked;
    if (visible) {
      map.addLayer(layerGroups[type]);
    } else {
      map.removeLayer(layerGroups[type]);
    }
  });
}

function addFeatureToSearchIndex(type, feature) {
  const label = resolveFeatureTitle(feature, type);
  const subtitle = getFeatureSubtitle(feature, type);

  featureIndex.push({
    type,
    label,
    subtitle,
    feature,
    text: JSON.stringify(feature.properties || {}).toLowerCase(),
  });
}

function buildSearchResults(query) {
  const searchTerm = query.trim().toLowerCase();

  if (!searchTerm) {
    searchResults.innerHTML = "";
    return;
  }

  const results = featureIndex.filter((entry) => {
    const haystack =
      `${entry.label} ${entry.subtitle} ${entry.text}`.toLowerCase();
    return haystack.includes(searchTerm);
  });

  if (!results.length) {
    searchResults.innerHTML =
      '<div class="search-result empty-search">No results found.</div>';
    return;
  }

  searchResults.innerHTML = results
    .slice(0, 12)
    .map(
      (entry) => `
        <button class="search-result" type="button" data-type="${entry.type}" data-index="${featureIndex.indexOf(entry)}">
            <div class="search-result-title">${entry.label}</div>
            <div class="search-result-subtitle">${entry.subtitle}</div>
        </button>
    `,
    )
    .join("");

  searchResults.querySelectorAll(".search-result").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.type;
      const index = Number(button.dataset.index);
      const target = featureIndex[index];
      if (!target) {
        return;
      }

      const { feature } = target;
      const bounds =
        feature.geometry &&
        (feature.geometry.type === "Point" ||
          feature.geometry.type === "MultiPoint")
          ? L.latLng(
              feature.geometry.coordinates[1],
              feature.geometry.coordinates[0],
            )
          : layerGroups[type]
              .getLayers()
              .find((layer) => layer.feature === feature);

      if (bounds && bounds.getLatLng) {
        map.flyTo(bounds.getLatLng(), 18, { duration: 0.8 });
      } else if (
        feature.geometry &&
        feature.geometry.type.includes("Polygon")
      ) {
        const layer = layerGroups[type]
          .getLayers()
          .find((item) => item.feature === feature);
        if (layer) {
          const latlng = layer.getBounds().getCenter();
          map.flyTo(latlng, 18, { duration: 0.8 });
        }
      }

      renderInfoPanel(feature, type);
      searchPanel.classList.add("hidden");
      searchInput.value = "";
      searchResults.innerHTML = "";
    });
  });
}

function renderLayer(type, data) {
  const typeName = typeLabelMap[type] || type;

  const layer = L.geoJSON(data, {
    style: (feature) => {
      const base = {
        color:
          type === "parcel"
            ? "#3f4f4e"
            : type === "trees"
              ? "#214f37"
              : type === "turf"
                ? "#7fa85d"
                : "#2e7d4d",
        weight: type === "parcel" ? 2 : 1.5,
        opacity: 0.9,
        fillOpacity: type === "parcel" ? 0.12 : 0.35,
        fillColor:
          type === "parcel"
            ? "#dfe9e6"
            : type === "trees"
              ? "#2f7d50"
              : type === "turf"
                ? "#96bf77"
                : "#49b86c",
      };
      return base;
    },
    pointToLayer: (feature, latlng) => {
      const marker = L.circleMarker(latlng, {
        radius: 7,
        color: "#1c7a45",
        fillColor: "#48c96c",
        weight: 2,
        fillOpacity: 0.9,
      });
      marker.bindTooltip(resolveFeatureTitle(feature, type), {
        direction: "top",
      });
      marker.on("click", () => renderInfoPanel(feature, type));
      return marker;
    },
    onEachFeature: (feature, layerInstance) => {
      if (feature.geometry && feature.geometry.type !== "Point") {
        layerInstance.bindTooltip(resolveFeatureTitle(feature, type), {
          sticky: true,
        });
      }
      layerInstance.on("click", () => renderInfoPanel(feature, type));
      addFeatureToSearchIndex(type, feature);
    },
  });

  layerGroups[type].addLayer(layer);

  if (type === "plants") {
    layer.eachLayer((item) =>
      item.on("popupopen", () => setMobileInfoOpen(true)),
    );
  }
}

async function loadGeoJsonFile(filePath, type) {
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`Unable to load ${type} data (${response.status})`);
  }
  const data = await response.json();
  if (!data || !data.features || !data.features.length) {
    return;
  }
  renderLayer(type, data);
}

async function initializeMapData() {
  const datasets = [
    ["plants", "data/plants.geojson"],
    ["trees", "data/trees.geojson"],
    ["turf", "data/turf.geojson"],
    ["parcel", "data/parcel.geojson"],
  ];

  for (const [type, file] of datasets) {
    try {
      await loadGeoJsonFile(file, type);
    } catch (error) {
      console.error(error);
    }
  }

  updateFeatureCounts();

  const bounds = L.latLngBounds([]);
  Object.values(layerGroups).forEach((group) => {
    group.eachLayer((layer) => {
      if (layer.getBounds) {
        bounds.extend(layer.getBounds());
      } else if (layer.getLatLng) {
        bounds.extend(layer.getLatLng());
      }
    });
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.25));
  }
}

searchInput.addEventListener("input", (event) => {
  buildSearchResults(event.target.value);
});

searchToggle.addEventListener("click", () => {
  toggleSearchPanel();
});

layersToggle.addEventListener("click", () => {
  toggleLayerPanel();
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  searchResults.innerHTML = "";
  searchInput.focus();
});

closeInfo.addEventListener("click", () => {
  setMobileInfoOpen(false);
});

closeLayers.addEventListener("click", () => {
  layerPanel.classList.add("hidden");
});

mobileLayers.addEventListener("click", () => {
  toggleLayerPanel();
});

mobileSearch.addEventListener("click", () => {
  toggleSearchPanel();
});

mobileInfo.addEventListener("click", () => {
  setMobileInfoOpen(true);
});

Object.entries(layerCheckboxes).forEach(([type, checkbox]) => {
  checkbox.addEventListener("change", refreshLayerVisibility);
});

searchPanel.classList.add("hidden");
layerPanel.classList.add("hidden");
infoPanel.classList.remove("mobile-open");
initializeMapData();
