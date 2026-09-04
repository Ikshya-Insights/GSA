const defaultMapView = {
  center: [19.1323, 72.9153],
  zoom: 17,
};

const vegetationIconConfig = {
  plants: {
    url: "icons/plant_icon.png?v=icons-refresh-2",
    size: [10, 10],
    anchor: [5, 10],
    tooltipAnchor: [0, -9],
  },
  trees: {
    url: "icons/tree_icon.png?v=icons-refresh-2",
    size: [12, 12],
    anchor: [6, 12],
    tooltipAnchor: [0, -11],
  },
};

const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
  preferCanvas: true,
}).setView(defaultMapView.center, defaultMapView.zoom);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const layerGroups = {
  parcel: L.layerGroup().addTo(map),
  plants: L.layerGroup().addTo(map),
  trees: L.layerGroup().addTo(map),
  turf: L.layerGroup().addTo(map),
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
const resetExtent = document.getElementById("resetExtent");
const openDashboard = document.getElementById("openDashboard");
const openTableView = document.getElementById("openTableView");
const cursorCoordinates = document.getElementById("cursorCoordinates");
const tableView = document.getElementById("tableView");
const closeTableView = document.getElementById("closeTableView");
const tableViewTitle = document.getElementById("tableViewTitle");
const tableViewMeta = document.getElementById("tableViewMeta");
const featureTable = document.getElementById("featureTable");

const infoType = document.getElementById("infoType");
const infoTitle = document.getElementById("infoTitle");
const infoContent = document.getElementById("infoContent");

const layerCheckboxes = {
  plants: document.getElementById("togglePlants"),
  trees: document.getElementById("toggleTrees"),
  turf: document.getElementById("toggleTurf"),
  parcel: document.getElementById("toggleParcel"),
};

const featureIndex = [];
const tableData = {};
let highlightedFeature = null;

const typeLabelMap = {
  plants: "Plant",
  trees: "Tree",
  turf: "Turf",
  parcel: "Parcel 59",
};

function setMobileInfoOpen(open) {
  infoPanel.classList.toggle("mobile-open", open);
}

function formatCoordinate(value, positiveDirection, negativeDirection) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positiveDirection : negativeDirection}`;
}

function updateCursorCoordinates(event) {
  cursorCoordinates.textContent = `${formatCoordinate(event.latlng.lat, "N", "S")}  ${formatCoordinate(event.latlng.lng, "E", "W")}`;
}

function clearFeatureHighlight() {
  if (!highlightedFeature) {
    return;
  }

  const { element, layer, style } = highlightedFeature;
  element?.classList.remove("feature-highlight-icon");
  layer?.setZIndexOffset?.(0);
  if (layer?.setStyle && style) {
    layer.setStyle(style);
  }
  highlightedFeature = null;
}

function highlightFeature(layer, type) {
  clearFeatureHighlight();

  const element = layer.getElement?.();
  if (element && layer.setStyle && type !== "trees") {
    highlightedFeature = {
      layer,
      style: {
        color: layer.options.color,
        weight: layer.options.weight,
        opacity: layer.options.opacity,
        fillColor: layer.options.fillColor,
        fillOpacity: layer.options.fillOpacity,
      },
    };
    layer.setStyle({
      color: "#f59e0b",
      weight: 3,
      opacity: 1,
      fillColor: "#fef3c7",
      fillOpacity: 0.45,
    });
    return;
  }

  if (element) {
    element.classList.add("feature-highlight-icon");
    layer.setZIndexOffset?.(1000);
    highlightedFeature = { element, layer };
  }
}

function attachFeatureHighlight(layer, type) {
  layer.on("click", () => highlightFeature(layer, type));
  layer.on("popupclose", clearFeatureHighlight);
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

function renderTableView(type) {
  const data = tableData[type];
  if (!data || !data.features.length) {
    tableViewTitle.textContent = typeLabelMap[type] || "Data";
    tableViewMeta.textContent = "No data available.";
    featureTable.replaceChildren();
    return;
  }

  const columns = [...new Set(
    data.features.flatMap((feature) => Object.keys(feature.properties || {})),
  )];
  const headerRow = document.createElement("tr");
  columns.forEach((column) => {
    const header = document.createElement("th");
    header.scope = "col";
    header.textContent = column.replace(/_/g, " ");
    headerRow.appendChild(header);
  });

  const thead = document.createElement("thead");
  thead.appendChild(headerRow);
  const tbody = document.createElement("tbody");
  data.features.forEach((feature) => {
    const row = document.createElement("tr");
    const properties = feature.properties || {};
    columns.forEach((column) => {
      const cell = document.createElement("td");
      cell.textContent = safeText(properties[column]);
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });

  tableViewTitle.textContent = typeLabelMap[type] || type;
  tableViewMeta.textContent = `${data.features.length.toLocaleString()} records · ${columns.length} fields`;
  featureTable.replaceChildren(thead, tbody);
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

function buildPopupTable(feature, type) {
  const title = resolveFeatureTitle(feature, type);
  const subtitle = getFeatureSubtitle(feature, type);
  const rows = formatAttributeList(feature, type);
  const imageUrl = resolveFeatureImage(feature, type);

  const bodyMarkup = rows.length
    ? rows
        .map(
          ([key, value]) => `
            <tr>
              <th>${safeText(key).replace(/_/g, " ")}</th>
              <td>${safeText(value)}</td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <th>Details</th>
        <td>No additional metadata available.</td>
      </tr>
    `;

  const imageMarkup = imageUrl
    ? `<div class="feature-popup-image-wrap"><img src="${imageUrl}" alt="${title}" class="feature-popup-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="feature-popup-image-placeholder" style="display:none;">Image unavailable</div></div>`
    : `<div class="feature-popup-image-placeholder feature-popup-image-placeholder--muted">Image coming soon</div>`;

  return `
    <div class="feature-popup">
      <div class="feature-popup-header">
        <strong>${title}</strong>
        <span>${subtitle}</span>
      </div>
      ${imageMarkup}
      <div class="feature-popup-scroll">
        <table class="feature-popup-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            ${bodyMarkup}
          </tbody>
        </table>
      </div>
    </div>
  `;
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

  // Keep map clicks focused on the popup and do not open the separate info panel.
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
            ? "#d32f2f"
            : type === "trees"
              ? "transparent"
              : type === "turf"
                ? "#7fa85d"
                : "#2e7d4d",
        weight: type === "parcel" ? 2 : type === "trees" ? 0 : 1.5,
        opacity: type === "trees" ? 0 : 0.9,
        fillOpacity: type === "parcel" ? 0.12 : type === "trees" ? 0 : 0.35,
        fillColor:
          type === "parcel"
            ? "#f8d7d7"
            : type === "trees"
              ? "transparent"
              : type === "turf"
                ? "#96bf77"
                : "#49b86c",
      };
      return base;
    },
    pointToLayer: (feature, latlng) => {
      const iconConfig = vegetationIconConfig[type];
      const marker = iconConfig
        ? L.marker(latlng, {
            icon: L.icon({
              iconUrl: iconConfig.url,
              iconSize: iconConfig.size,
              iconAnchor: iconConfig.anchor,
              tooltipAnchor: iconConfig.tooltipAnchor,
            }),
          })
        : L.circleMarker(latlng, {
            radius: 7,
            color: "#1c7a45",
            fillColor: "#48c96c",
            weight: 2,
            fillOpacity: 0.9,
          });
      marker.bindTooltip(resolveFeatureTitle(feature, type), {
        direction: "top",
      });
      marker.bindPopup(buildPopupTable(feature, type), {
        maxWidth: 280,
        className: "feature-popup-wrapper",
      });
      attachFeatureHighlight(marker, type);
      return marker;
    },
    onEachFeature: (feature, layerInstance) => {
      if (feature.geometry && feature.geometry.type !== "Point") {
        layerInstance.bindTooltip(resolveFeatureTitle(feature, type), {
          sticky: true,
        });
        layerInstance.bindPopup(buildPopupTable(feature, type), {
          maxWidth: 280,
          className: "feature-popup-wrapper",
        });
        attachFeatureHighlight(layerInstance, type);

        if (type === "parcel" && layerInstance.bringToBack) {
          layerInstance.bringToBack();
        }

        if (type === "trees" && layerInstance.getBounds) {
          const iconConfig = vegetationIconConfig.trees;
          const treeIcon = L.marker(layerInstance.getBounds().getCenter(), {
            icon: L.icon({
              iconUrl: iconConfig.url,
              iconSize: iconConfig.size,
              iconAnchor: iconConfig.anchor,
              tooltipAnchor: iconConfig.tooltipAnchor,
            }),
          });
          treeIcon.bindTooltip(resolveFeatureTitle(feature, type), {
            direction: "top",
          });
          treeIcon.bindPopup(buildPopupTable(feature, type), {
            maxWidth: 280,
            className: "feature-popup-wrapper",
          });
          attachFeatureHighlight(treeIcon, type);
          layerGroups[type].addLayer(treeIcon);
        }
      }
      addFeatureToSearchIndex(type, feature);
    },
  });

  layerGroups[type].addLayer(layer);

}

async function loadGeoJsonFile(filePath, type) {
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`Unable to load ${type} data (${response.status})`);
  }
  const data = await response.json();
  tableData[type] = data;
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

resetExtent.addEventListener("click", () => {
  map.setView(defaultMapView.center, defaultMapView.zoom, {
    animate: true,
  });
});

openDashboard.addEventListener("click", () => {
  window.open("dashboard.html", "_blank", "noopener,noreferrer");
});

map.on("mousemove", updateCursorCoordinates);

openTableView.addEventListener("click", () => {
  tableView.classList.remove("hidden");
  renderTableView(document.querySelector('input[name="tableType"]:checked').value);
});

closeTableView.addEventListener("click", () => {
  tableView.classList.add("hidden");
});

document.querySelectorAll('input[name="tableType"]').forEach((input) => {
  input.addEventListener("change", () => renderTableView(input.value));
});

Object.entries(layerCheckboxes).forEach(([type, checkbox]) => {
  checkbox.addEventListener("change", refreshLayerVisibility);
});

searchPanel.classList.add("hidden");
layerPanel.classList.add("hidden");
infoPanel.classList.remove("mobile-open");
initializeMapData();
