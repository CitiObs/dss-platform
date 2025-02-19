import { inject } from "vue";
import { withAsync } from "@geoint/geoint-vue";

export function useSWNPApi () {
    const geoint = inject("geoint");
    const api = geoint.api("virtualair");

    let abortController = null;

    const MAX_OBSERVATION_REQUESTS = 2;

    function abortRequest () {
        if (abortController) {
            // Abort the request and clear the abortController
            abortController.abort();
            abortController = null;
        }
    }

    function getOldestTimeOfLastLocation (locations) {
        // Sort locations by time (latest first)
        const sortedLocations = locations.value.sort((a, b) => new Date(b.time) - new Date(a.time));
    
        let lastCoordinates = null;
        let oldestTime = null;
    
        for (let i = 0; i < sortedLocations.length; i++) {
            const currentLocation = sortedLocations[i].Locations?.[0]?.location;
            if (!currentLocation) continue;
    
            const currentCoordinates = JSON.stringify(currentLocation.coordinates);
    
            // If coordinates change, update the oldest time for the last location
            if (lastCoordinates !== null && lastCoordinates !== currentCoordinates) {
                break; // Stop at the first change
            }
    
            lastCoordinates = currentCoordinates;
            oldestTime = sortedLocations[i].time;
        }
    
        return oldestTime;
    }

    function filterObservationsByTime(oldestTime, observations) {
        const oldestDate = new Date(oldestTime);
        return observations.filter(obs => new Date(obs.phenomenonTime) >= oldestDate);
    }

    async function getSensorLocations (thingLink) {
        const params = { 
            $expand: "Locations($select=location)",
        };

        const { response, error } = await withAsync(
            api.get,
            `${thingLink}/HistoricalLocations`,
            {
                params,
                signal: abortController.signal,
            }
        );

        if (error) {
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
            return;
        }

        return response.data;
    }

    async function getMoreObservations (observationsLink) {
        const { response, error } = await withAsync(
            api.get,
            observationsLink,
            {
                signal: abortController.signal,
            }
        );

        if (error) {
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
            return;
        }

        return response.data;
    }

    async function getSensorDatastreams (datastreamLink) {
        const params = { 
            $expand: "Observations($select=phenomenonTime,result;$orderby=phenomenonTime desc),Thing($select=@iot.id,name),Sensor($select=name),License($select=name)",
            $filter: "(ObservedProperty/definition eq 'http://vocabs.lter-europe.net/EnvThes/22035')",
        };

        const { response, error } = await withAsync(
            api.get,
            datastreamLink,
            {
                params,
                signal: abortController.signal,
            }
        );

        if (error) {
            // Only log unexpected errors
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
            return;
        }

        return response.data;
    }

    async function getOverviewData (datastreamLink, thingLink) {
        //  Create a new AbortController for these requests
        abortController = new AbortController();

        const [datastream, locations] = await Promise.all([
            getSensorDatastreams(datastreamLink),
            getSensorLocations(thingLink)
        ]);

        if (!datastream || !locations) return;

        let nextLink = datastream["Observations@iot.nextLink"];

        for(let i = 0; i < MAX_OBSERVATION_REQUESTS; i++) {
            if (!nextLink) break;

            const moreObservations = await getMoreObservations(nextLink);

            if (!moreObservations) break;

            nextLink = moreObservations?.["@iot.nextLink"];
            datastream.Observations.push(...moreObservations.value);
        }

        const oldestTime = getOldestTimeOfLastLocation(locations);
        const lastLocationObservations = filterObservationsByTime(oldestTime, datastream.Observations);

        const sensorInfo = {
            metric: datastream.name,
            unitOfMeasurement: datastream.unitOfMeasurement.symbol,
            thingId: datastream.Thing["@iot.id"],
            thingName: datastream.Thing.name,
            sensorType: datastream.Sensor.name,
            dataOrigin: "citiobs_demo",
            license: datastream.License.name
        };

        return { 
            sensorInfo, 
            observations: lastLocationObservations
        };
    }

    return {
        getOverviewData,
        abortRequest
    };
}