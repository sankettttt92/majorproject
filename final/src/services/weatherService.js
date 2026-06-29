import axios from 'axios';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

// Open-Meteo is completely free, no key required.
// Returns current weather + hourly precipitation forecast.
export async function fetchWeather(lat, lon) {
  try {
    const { data } = await axios.get(OPEN_METEO, {
      params: {
        latitude: lat,
        longitude: lon,
        current: [
          'temperature_2m',
          'apparent_temperature',
          'precipitation',
          'rain',
          'weather_code',
          'wind_speed_10m',
          'relative_humidity_2m',
          'visibility',
        ].join(','),
        hourly: 'precipitation_probability,precipitation',
        forecast_days: 1,
        timezone: 'Asia/Kolkata',
      },
    });

    const c = data.current;
    const maxPrecipProb = Math.max(...(data.hourly?.precipitation_probability || [0]));

    return {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      rain: c.rain,
      precipitation: c.precipitation,
      weatherCode: c.weather_code,
      windSpeed: Math.round(c.wind_speed_10m),
      humidity: c.relative_humidity_2m,
      visibility: Math.round((c.visibility || 10000) / 1000),
      maxPrecipProbability: maxPrecipProb,
      floodRisk: deriveFloodRisk(c.rain, maxPrecipProb, c.weather_code),
    };
  } catch (err) {
    console.error('Weather fetch failed:', err.message);
    return null;
  }
}

// Derive a flood risk level from weather data
function deriveFloodRisk(rain, precipProb, code) {
  // WMO weather codes: 51-67 = drizzle/rain, 71-77 = snow, 80-82 = rain showers, 95-99 = thunderstorm
  const isThunderstorm = code >= 95;
  const isHeavyRain = code >= 63 && code <= 67;
  const isShower = code >= 80 && code <= 82;

  if (rain > 10 || (isThunderstorm && precipProb > 70)) return 'CRITICAL';
  if (rain > 5 || isHeavyRain || (isShower && precipProb > 60)) return 'HIGH';
  if (rain > 2 || precipProb > 50) return 'MODERATE';
  return 'LOW';
}

// Fetch incidents from USGS Earthquake feed as a proxy for "real" live incidents
// (In a real app you'd call your own backend / NDRF API)
export async function fetchNearbyHazards(lat, lon) {
  try {
    const { data } = await axios.get(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
      { timeout: 5000 }
    );

    const features = data.features || [];

    // Filter to within ~500km (rough lat/lon degree box)
    const nearby = features
      .filter((f) => {
        const [flon, flat] = f.geometry.coordinates;
        return Math.abs(flat - lat) < 5 && Math.abs(flon - lon) < 5;
      })
      .slice(0, 3)
      .map((f) => ({
        id: f.id,
        title: f.properties.title,
        severity: f.properties.mag > 5 ? 'CRITICAL' : f.properties.mag > 3 ? 'WARNING' : 'INFO',
        time: new Date(f.properties.time),
        type: 'SEISMIC',
      }));

    return nearby;
  } catch {
    return [];
  }
}

// Road/traffic incidents via a simple Overpass API query (OpenStreetMap)
export async function fetchRoadIncidents(lat, lon) {
  // In production, replace with NHAI / HERE / TomTom traffic API
  // For now return empty so the app populates from local state
  return [];
}

// ─── Live nearby relief points (hospitals, schools, community centres etc) ──
// Uses OpenStreetMap's Overpass API — free, no API key required.

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter', // fallback mirror if primary is overloaded
];

// Amenity/building tags that act as disaster relief points
const RELIEF_TAGS = [
  '["amenity"="hospital"]',
  '["amenity"="clinic"]',
  '["amenity"="doctors"]',
  '["amenity"="school"]',
  '["amenity"="college"]',
  '["amenity"="university"]',
  '["amenity"="community_centre"]',
  '["amenity"="social_facility"]',
  '["amenity"="police"]',
  '["amenity"="fire_station"]',
  '["emergency"="assembly_point"]',
  '["building"="hospital"]',
];

function buildOverpassQuery(lat, lon, radiusMeters) {
  const filters = RELIEF_TAGS.map(
    (tag) => `nwr(around:${radiusMeters},${lat},${lon})${tag};`
  ).join('\n      ');

  return `
    [out:json][timeout:25];
    (
      ${filters}
    );
    out center tags;
  `;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Maps raw OSM tags to a clean type + icon name (Ionicons) for the UI
function classifyReliefPoint(tags = {}) {
  if (tags.amenity === 'hospital' || tags.building === 'hospital') {
    return { type: 'HOSPITAL', icon: 'medkit-outline', label: 'Hospital' };
  }
  if (tags.amenity === 'clinic' || tags.amenity === 'doctors') {
    return { type: 'CLINIC', icon: 'medical-outline', label: 'Clinic' };
  }
  if (['school', 'college', 'university'].includes(tags.amenity)) {
    return { type: 'SCHOOL', icon: 'school-outline', label: 'School / Institute' };
  }
  if (tags.amenity === 'police') {
    return { type: 'POLICE', icon: 'shield-outline', label: 'Police Station' };
  }
  if (tags.amenity === 'fire_station') {
    return { type: 'FIRE', icon: 'flame-outline', label: 'Fire Station' };
  }
  if (tags.amenity === 'community_centre' || tags.amenity === 'social_facility') {
    return { type: 'SHELTER', icon: 'home-outline', label: 'Community Centre' };
  }
  if (tags.emergency === 'assembly_point') {
    return { type: 'ASSEMBLY', icon: 'people-outline', label: 'Assembly Point' };
  }
  return { type: 'OTHER', icon: 'location-outline', label: 'Relief Point' };
}

/**
 * Fetch real nearby disaster-relief locations (hospitals, schools, clinics,
 * police/fire stations, community centres) around a given lat/lon.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusMeters - search radius in meters (default 5000 = 5km)
 * @returns {Promise<Array>} sorted by distance ascending
 */
export async function fetchNearbyShelters(lat, lon, radiusMeters = 5000) {
  if (lat == null || lon == null) return [];

  const query = buildOverpassQuery(lat, lon, radiusMeters);
  const body = 'data=' + encodeURIComponent(query);

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!res.ok) continue; // try next mirror
      const data = await res.json();
      const elements = data.elements || [];

      const results = elements
        .map((el) => {
          // Ways/relations return `center`, nodes return lat/lon directly
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (elLat == null || elLon == null) return null;

          const tags = el.tags || {};
          const meta = classifyReliefPoint(tags);
          const distanceKm = haversineDistanceKm(lat, lon, elLat, elLon);

          return {
            id: `osm-${el.type}-${el.id}`,
            name: tags.name || meta.label,
            type: meta.type,
            icon: meta.icon,
            address:
              [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'] || tags['addr:city']]
                .filter(Boolean)
                .join(', ') || 'Address unavailable',
            phone: tags.phone || tags['contact:phone'] || null,
            emergency: tags.emergency === 'yes' || tags['healthcare:speciality'] === 'emergency',
            distanceKm: Math.round(distanceKm * 10) / 10,
            lat: elLat,
            lon: elLon,
          };
        })
        .filter(Boolean)
        // de-duplicate same lat/lon+name pairs (ways often double up with nodes)
        .filter(
          (item, idx, arr) =>
            arr.findIndex((o) => o.name === item.name && o.lat === item.lat && o.lon === item.lon) === idx
        )
        .sort((a, b) => a.distanceKm - b.distanceKm);

      return results;
    } catch (err) {
      console.warn(`Overpass endpoint failed (${endpoint}):`, err.message);
      // try next mirror
    }
  }

  console.error('All Overpass endpoints failed.');
  return [];
}