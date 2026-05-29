mapboxgl.accessToken = "pk.eyJ1IjoiZGFsdG9ud2IiLCJhIjoiOWdSSXFQSSJ9.HZyjh4g3TAAOAncwelv9Vw";

const MAP_STYLE = "mapbox://styles/daltonwb/cmppy5827006g01qn8ri0chn3";
const ROUTE_DRAW_MS = 4000;
const ROUTE_FIT_MS = 1700;
const MAP_MAX_BOUNDS = [
  [-18, -18],
  [150, 72]
];

const routes = {
  "baltic-india": {
    label: "Baltic Sea to India route",
    color: "#f2c15f",
    features: [
      {
        type: "Feature",
        properties: {
          route: "baltic-india",
          label: "Baltic Sea to India"
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [18.6, 59.3],
            [15.1, 55.4],
            [12.4, 55.9],
            [11.0, 57.7],
            [5.1, 56.2],
            [1.4, 51.7],
            [-1.2, 50.4],
            [-5.8, 48.5],
            [-8.4, 45.2],
            [-10.2, 41.2],
            [-9.4, 37.2],
            [-5.55, 36.05],
            [11.7, 36.3],
            [18.8, 34.9],
            [29.6, 32.2],
            [32.55, 29.95],
            [37.8, 20.0],
            [43.3, 12.6],
            [57.0, 15.0],
            [72.7, 18.75]
          ]
        }
      }
    ],
    points: [
      ["Baltic Sea", [18.6, 59.3], "origin"],
      ["Danish straits", [12.4, 55.9], "chokepoint"],
      ["Gibraltar", [-5.55, 36.05], "chokepoint"],
      ["Suez", [32.55, 29.95], "chokepoint"],
      ["Bab al-Mandeb", [43.3, 12.6], "chokepoint"],
      ["India", [72.7, 18.75], "destination"]
    ]
  },
  "gulf-east-asia": {
    label: "Gulf to East Asia route",
    color: "#7cc7d9",
    features: [
      {
        type: "Feature",
        properties: {
          route: "gulf-east-asia",
          label: "Gulf to East Asia"
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [51.8, 26.05],
            [56.55, 26.35],
            [63.5, 22.6],
            [71.0, 9.0],
            [82.5, 5.8],
            [95.7, 5.4],
            [99.4, 3.8],
            [103.8, 1.3],
            [112.0, 8.5],
            [121.0, 20.5]
          ]
        }
      },
      {
        type: "Feature",
        properties: {
          route: "gulf-east-asia",
          label: "Japan branch"
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [121.0, 20.5],
            [124.5, 24.2],
            [129.0, 28.0],
            [134.0, 31.5],
            [139.75, 35.2]
          ]
        }
      },
      {
        type: "Feature",
        properties: {
          route: "gulf-east-asia",
          label: "South Korea branch"
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [121.0, 20.5],
            [124.5, 25.5],
            [126.2, 31.5],
            [128.8, 34.8]
          ]
        }
      }
    ],
    points: [
      ["Persian Gulf", [51.8, 26.05], "origin"],
      ["Hormuz", [56.55, 26.35], "chokepoint"],
      ["Malacca", [103.8, 1.3], "chokepoint"],
      ["South Korea", [128.8, 34.8], "destination"],
      ["Japan", [139.75, 35.2], "destination"]
    ]
  }
};

const routeIds = Object.keys(routes);
let activeRoute = "baltic-india";
let animationFrame = null;

const map = new mapboxgl.Map({
  container: "map",
  style: MAP_STYLE,
  projection: {
    name: "equalEarth"
  },
  center: [84.961294, 20.770614],
  zoom: 2.15,
  bearing: 0,
  pitch: 12,
  maxBounds: MAP_MAX_BOUNDS,
  renderWorldCopies: false,
  attributionControl: false,
  cooperativeGestures: true
});

map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
map.addControl(new mapboxgl.AttributionControl({ compact: false }), "bottom-left");

const buttons = Array.from(document.querySelectorAll("[data-map-state]"));
const status = document.getElementById("map-status");

function featureCollection(features = []) {
  return {
    type: "FeatureCollection",
    features
  };
}

function getAllRouteFeatures() {
  return routeIds.flatMap((routeId) => routes[routeId].features);
}

function getAllPointFeatures() {
  return routeIds.flatMap((routeId) => routes[routeId].points.map(([name, coordinates, kind]) => ({
    type: "Feature",
    properties: {
      route: routeId,
      name,
      kind
    },
    geometry: {
      type: "Point",
      coordinates
    }
  })));
}

function routeFitPadding() {
  const compact = window.innerWidth <= 600;

  return {
    top: compact ? 112 : 92,
    right: compact ? 32 : 56,
    bottom: 56,
    left: compact ? 32 : 56
  };
}

function getRouteBounds(routeId) {
  const coordinates = routes[routeId].features.flatMap((feature) => feature.geometry.coordinates);
  if (!coordinates.length) return null;

  return coordinates.slice(1).reduce((bounds, coordinate) => {
    bounds.extend(coordinate);
    return bounds;
  }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function distanceKm(a, b) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(b[1] - a[1]);
  const deltaLng = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function lineLengthKm(coordinates) {
  return coordinates.slice(1).reduce((total, coordinate, index) => {
    return total + distanceKm(coordinates[index], coordinate);
  }, 0);
}

function partialLine(coordinates, targetDistance) {
  if (targetDistance <= 0) return [];

  const result = [coordinates[0]];
  let travelled = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const segmentLength = distanceKm(previous, current);

    if (travelled + segmentLength <= targetDistance) {
      result.push(current);
      travelled += segmentLength;
      continue;
    }

    const segmentProgress = (targetDistance - travelled) / segmentLength;
    result.push([
      previous[0] + (current[0] - previous[0]) * segmentProgress,
      previous[1] + (current[1] - previous[1]) * segmentProgress
    ]);
    break;
  }

  return result.length > 1 ? result : [];
}

function getPartialRoute(routeId, progress) {
  const features = routes[routeId].features;
  const lengths = features.map((feature) => lineLengthKm(feature.geometry.coordinates));
  const routeLength = lengths.reduce((sum, length) => sum + length, 0);
  let remainingDistance = routeLength * Math.min(Math.max(progress, 0), 1);

  return featureCollection(features.reduce((visibleFeatures, feature, index) => {
    const segmentLength = lengths[index];

    if (remainingDistance <= 0) return visibleFeatures;

    if (remainingDistance >= segmentLength) {
      visibleFeatures.push(feature);
      remainingDistance -= segmentLength;
      return visibleFeatures;
    }

    const coordinates = partialLine(feature.geometry.coordinates, remainingDistance);
    if (coordinates.length > 1) {
      visibleFeatures.push({
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates
        }
      });
    }
    remainingDistance = 0;

    return visibleFeatures;
  }, []));
}

function routeColorExpression() {
  return [
    "match",
    ["get", "route"],
    "baltic-india", routes["baltic-india"].color,
    "gulf-east-asia", routes["gulf-east-asia"].color,
    "#ffffff"
  ];
}

function addRouteLayers() {
  map.addSource("shipping-routes", {
    type: "geojson",
    data: featureCollection(getAllRouteFeatures())
  });

  map.addSource("active-route", {
    type: "geojson",
    data: getPartialRoute(activeRoute, 1)
  });

  map.addSource("route-points", {
    type: "geojson",
    data: featureCollection(getAllPointFeatures())
  });

  map.addLayer({
    id: "routes-muted",
    type: "line",
    source: "shipping-routes",
    paint: {
      "line-color": routeColorExpression(),
      "line-opacity": [
        "case",
        ["==", ["get", "route"], activeRoute],
        0.18,
        0.34
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2, 2.2,
        6, 4
      ]
    }
  });

  map.addLayer({
    id: "active-route-casing",
    type: "line",
    source: "active-route",
    paint: {
      "line-color": "#142326",
      "line-opacity": 0.86,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2, 6,
        6, 10
      ]
    }
  });

  map.addLayer({
    id: "active-route",
    type: "line",
    source: "active-route",
    paint: {
      "line-color": routeColorExpression(),
      "line-opacity": 0.96,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2, 3,
        6, 6
      ]
    }
  });

  map.addLayer({
    id: "route-point-halo",
    type: "circle",
    source: "route-points",
    paint: {
      "circle-color": "#142326",
      "circle-radius": [
        "case",
        ["==", ["get", "kind"], "chokepoint"],
        6,
        5
      ],
      "circle-opacity": 0.88,
      "circle-stroke-color": routeColorExpression(),
      "circle-stroke-width": 2
    }
  });

  map.addLayer({
    id: "route-point-labels",
    type: "symbol",
    source: "route-points",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        2, 10,
        5, 13
      ],
      "text-anchor": "top",
      "text-offset": [0, 0.8],
      "text-allow-overlap": false
    },
    paint: {
      "text-color": "#f6eee6",
      "text-halo-color": "#142326",
      "text-halo-width": 1.2,
      "text-opacity": [
        "case",
        ["==", ["get", "route"], activeRoute],
        1,
        0.38
      ]
    }
  });
}

function animateActiveRoute(routeId) {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
  }

  const source = map.getSource("active-route");
  if (!source) return;

  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / ROUTE_DRAW_MS, 1);
    source.setData(getPartialRoute(routeId, easeOutCubic(progress)));

    if (progress < 1) {
      animationFrame = window.requestAnimationFrame(frame);
    }
  }

  animationFrame = window.requestAnimationFrame(frame);
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function setActiveState(routeId) {
  const route = routes[routeId];
  if (!route) return;

  activeRoute = routeId;

  buttons.forEach((button) => {
    const isActive = button.dataset.mapState === routeId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (status) {
    status.textContent = route.label;
  }

  if (map.getLayer("routes-muted")) {
    map.setPaintProperty("routes-muted", "line-opacity", [
      "case",
      ["==", ["get", "route"], activeRoute],
      0.18,
      0.34
    ]);
  }

  if (map.getLayer("route-point-labels")) {
    map.setPaintProperty("route-point-labels", "text-opacity", [
      "case",
      ["==", ["get", "route"], activeRoute],
      1,
      0.38
    ]);
  }

  const bounds = getRouteBounds(routeId);
  if (bounds) {
    map.fitBounds(bounds, {
      padding: routeFitPadding(),
      bearing: 0,
      pitch: 18,
      duration: ROUTE_FIT_MS,
      essential: true
    });
  }

  animateActiveRoute(routeId);
}

buttons.forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
  button.addEventListener("click", () => setActiveState(button.dataset.mapState));
});

map.on("load", () => {
  addRouteLayers();
  setActiveState(activeRoute);
});
