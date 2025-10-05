import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import serverless from "serverless-http";

dotenv.config();

const AUTOSUGGEST_DOMAIN = "https://autosuggest.search.hereapi.com";
const AUTOSUGGEST_ENDPOINT = `${AUTOSUGGEST_DOMAIN}/v1/autosuggest`;

const TRANSIT_DOMAIN = "https://transit.router.hereapi.com";
const TRANSIT_ENDPOINT = `${TRANSIT_DOMAIN}/v8/routes`;

const HERE_API_KEY = process.env.HERE_API_KEY;

const DEFAULT_PARAMS = {
    lang: "it",
    apikey: HERE_API_KEY
}

const request = async (url = "", params = new URLSearchParams()) => {
    try {
        const res = await fetch(`${url}?${params.toString()}`);
        const data = await res.json();

        return data;
    } catch(err) {
        return [];
    }
}

export const autosuggest = async (q = "", lat = 0, lon = 0) => {
    const at = `${lat},${lon}`;

    const params = new URLSearchParams({ q, at, ...DEFAULT_PARAMS });
    const response = await request(AUTOSUGGEST_ENDPOINT, params);

    return response;
}

export const transit = async (origin = "", destination = "", departureTime = new Date().toISOString()) => {
    const params = new URLSearchParams({ origin, destination, departureTime, ...DEFAULT_PARAMS });
    const response = await request(TRANSIT_ENDPOINT, params);

    return response;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.get("/autosuggest", async(req, res) => {
    const q = req.query.q;
    const lat = req.query.lat || 0;
    const lon = req.query.lon || 0;

    if (!q) {
        res.json({error: "'q' parameter is mandatory"})

        return;
    }

    const response = await autosuggest(q, lat, lon);

    if (!response.items) {
        res.json([]);

        return;
    }
 
    const items = response.items.filter(i => i.address).map(i => {
        return {
            type: i.resultType,
            title: i.title,
            address: i.address.label,
            position: {
                latitude: i.position.lat,
                longitude: i.position.lng
            }
        }
    });

    res.json(items);
})

app.get("/transit", async (req, res) => {
    const origin = req.query.origin;
    const destination = req.query.destination;
    const departureTime = req.query.departureTime;

    if (!origin) {
        res.json({error: "'origin' parameter is mandatory"});

        return;
    }

    if (!destination) {
        res.json({error: "'origin' parameter is mandatory"});

        return;
    }

    const response = await transit(origin, destination, departureTime);
    res.json(response);
})

app.get("/", (_, res) => {
    res.json({ status: 200 })
})

export default serverless(app);