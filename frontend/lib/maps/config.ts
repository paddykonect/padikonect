// Google Maps browser config. The API key is a public (client-shipped) value —
// it must be referrer-restricted in Google Cloud. Maps degrade to a placeholder
// when the key is missing (see GoogleMap).
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Advanced Markers require a Map ID; DEMO_MAP_ID works for local dev.
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export const hasMapsKey = GOOGLE_MAPS_API_KEY.length > 0;
