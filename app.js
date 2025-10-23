import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const AUTOSUGGEST_DOMAIN = "https://autosuggest.search.hereapi.com";
const AUTOSUGGEST_ENDPOINT = `${AUTOSUGGEST_DOMAIN}/v1/autosuggest`;

const TRANSIT_DOMAIN = "https://transit.router.hereapi.com";
const TRANSIT_ENDPOINT = `${TRANSIT_DOMAIN}/v8/routes`;

const HERE_API_KEY = process.env.HERE_API_KEY;

const DEFAULT_PARAMS = {
  lang: "it",
  apikey: HERE_API_KEY,
};

const request = async (url = "", params = new URLSearchParams()) => {
  try {
    const res = await fetch(`${url}?${params.toString()}`);
    const data = await res.json();

    return data;
  } catch (err) {
    return [];
  }
};

export const autosuggest = async (q = "", lat = 0, lon = 0) => {
  const at = `${lat},${lon}`;

  const params = new URLSearchParams({ q, at, ...DEFAULT_PARAMS });
  const response = await request(AUTOSUGGEST_ENDPOINT, params);

  return response;
};

export const transit = async (origin = "", destination = "", departureTime = new Date().toISOString()) => {
  const params = new URLSearchParams({ origin, destination, departureTime, return: "intermediate", ...DEFAULT_PARAMS });
  const response = await request(TRANSIT_ENDPOINT, params);

  return response;
};

export const route = async (origin = "", destination = "", departureTime = new Date().toISOString()) => {
  const params = new URLSearchParams({ origin, destination, departureTime, return: "polyline", ...DEFAULT_PARAMS });
  const response = await request(TRANSIT_ENDPOINT, params);

  return response;
};

const getTrenitaliaStationCode = async (stationName) => {
  const res = await fetch(`http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/autocompletaStazione/${stationName}`);
  const data = await res.text();

  const [_, code] = data.split("|");

  return code.trim();
};

const getTrenitaliaTrains = async (stationCode, date) => {
  const res = await fetch(`http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${stationCode}/${new Date(date)}`);
  const data = await res.json();

  return data;
};

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.get("/autosuggest", async (req, res) => {
  const q = req.query.q;
  const lat = req.query.lat || 0;
  const lon = req.query.lon || 0;

  if (!q) {
    res.json({ error: "'q' parameter is mandatory" });

    return;
  }

  const response = await autosuggest(q, lat, lon);

  if (!response.items) {
    res.json([]);

    return;
  }

  const items = response.items
    .filter((i) => i.address)
    .map((i) => {
      return {
        id: i.id,
        type: i.resultType,
        title: i.title,
        address: i.address.label,
        position: {
          latitude: i.position.lat,
          longitude: i.position.lng,
        },
        category: i.categories ? i.categories.find((i) => i.primary).id : null,
      };
    });

  res.json(items);
});

app.get("/transit", async (req, res) => {
  const origin = req.query.origin;
  const destination = req.query.destination;
  const departureTime = req.query.departureTime;

  if (!origin) {
    res.json({ error: "'origin' parameter is mandatory" });

    return;
  }

  if (!destination) {
    res.json({ error: "'origin' parameter is mandatory" });

    return;
  }

  let response = await transit(origin, destination, departureTime);

  try {
    let sections = [];

    for (const section of response.routes[0].sections) {
      if (section.type === "transit" && section.agency.name === "TRENITALIA") {
        const station = section.departure.place.name;

        const stationCode = await getTrenitaliaStationCode(station);
        const trains = await getTrenitaliaTrains(stationCode, section.departure.time);
        if (trains.length > 0) {
          const train = trains.find((i) => i.orarioPartenza === new Date(section.departure.time).getTime());

          sections.push({ ...section, delay: train.ritardo });
        } else {
          sections.push(section);
        }
      } else {
        sections.push(section);
      }
    }

    response.routes[0].sections = sections;
  } catch (err) {
    console.log(err);
  }

  res.json(response);
});

app.get("/route", async (req, res) => {
  const origin = req.query.origin;
  const destination = req.query.destination;
  const departureTime = req.query.departureTime;

  if (!origin) {
    res.json({ error: "'origin' parameter is mandatory" });

    return;
  }

  if (!destination) {
    res.json({ error: "'origin' parameter is mandatory" });

    return;
  }

  const response = await route(origin, destination, departureTime);

  let polylines = [];
  for (const route of response.routes) {
    for (const section of route.sections) {
      polylines.push(section.polyline);
    }
  }
  res.json(polylines);
});

//http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/autocompletaStazione/avio
//http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/S02050/Sun%20Oct%2019%202025%2010:33:45%20GMT+0200%20(Ora%20legale%20dell%E2%80%99Europa%20centrale)

app.get("/", (_, res) => {
  res.json({ status: 200 });
});

app.listen(PORT, () => {
  console.log("ready");
});

export default app;
