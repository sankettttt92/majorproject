import { useState, useEffect, useCallback } from 'react';

let globalIncidents = [];
let listeners = [];

function notify() {
  listeners.forEach((fn) => fn([...globalIncidents]));
}

export function addIncident(incident) {
  const id = `INC-${Date.now()}`;
  globalIncidents = [{ id, timestamp: new Date(), ...incident }, ...globalIncidents];
  notify();
  return id;
}

export function seedIncidentsFromWeather(weather, address) {
  if (!weather) return;

  const existing = globalIncidents.map((i) => i.source);

  if (weather.floodRisk === 'CRITICAL' && !existing.includes('flood-auto')) {
    const river = address?.district?.includes('Noida') ? 'YAMUNA BANK' : 'NEARBY RIVER';
    addIncident({
      title: `FLOOD ALERT - ${river}`,
      severity: 'CRITICAL',
      source: 'flood-auto',
      type: 'FLOOD',
      detail: `Heavy rain detected. ${weather.rain}mm/hr. Precipitation probability ${weather.maxPrecipProbability}%.`,
      eta: 'T-minus: 12m',
    });
  }

  if (weather.windSpeed > 40 && !existing.includes('wind-auto')) {
    addIncident({
      title: `HIGH WIND WARNING`,
      severity: 'WARNING',
      source: 'wind-auto',
      type: 'WIND',
      detail: `Wind speed ${weather.windSpeed} km/h. Avoid open areas.`,
      eta: 'Active now',
    });
  }
}

export function useIncidents() {
  const [incidents, setIncidents] = useState([...globalIncidents]);

  useEffect(() => {
    listeners.push(setIncidents);
    return () => {
      listeners = listeners.filter((fn) => fn !== setIncidents);
    };
  }, []);

  const add = useCallback((inc) => addIncident(inc), []);
  const clear = useCallback((id) => {
    globalIncidents = globalIncidents.filter((i) => i.id !== id);
    notify();
  }, []);

  return { incidents, addIncident: add, clearIncident: clear };
}