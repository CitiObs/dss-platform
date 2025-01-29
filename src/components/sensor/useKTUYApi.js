import { inject } from "vue";
import { withAsync } from "@geoint/geoint-vue";

export function useKTUYApi () {
    const geoint = inject("geoint");
    const api = geoint.api("virtualair");

    let abortController = null;

    function categorizeByDatastreamId(observations) {
        return observations.reduce((acc, observation) => {
            const datastreamId = observation.Datastream["@iot.id"];
    
            if (!acc[datastreamId]) {
                acc[datastreamId] = [];
            }
    
            acc[datastreamId].push(observation);
            return acc;
        }, {});
    }

    function abortRequest () {
        if (abortController) {
            // Abort the request and clear the abortController
            abortController.abort();
            abortController = null;
        }
    }

    async function getThingData (thingLink) {
        const { response, error } = await withAsync(
            api.get,
            thingLink,
        );
    
        if (error) {
            return;
        }
    
        return response.data;
    }
    
    async function getSensorData (sensorLink) {
        const { response, error } = await withAsync(
            api.get,
            sensorLink,
        );
    
        if (error) {
            return;
        }

        return response.data;
    }

    async function getSensorObservations (observationsLink) {
        // Create a new AbortController for this request
        abortController = new AbortController();

        const params = { $expand: "Datastream" };
    
        const { response, error } = await withAsync(
            api.get,
            observationsLink,
            {
                params,
                signal: abortController.signal, // Attach the abort signal to the request
            }
        );
    
        if (error) {
            // Only log unexpected errors
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
            return;
        }

        return response.data.value;
    }

    async function getOverviewData (observationsLink) {
        const observations = await getSensorObservations(observationsLink);

        if (!observations?.length) return;
    
        const thingLink = observations[0].Datastream["Thing@iot.navigationLink"];
        const thingData = await getThingData(thingLink);
    
        const sensorLink = observations[0].Datastream["Sensor@iot.navigationLink"];
        const sensorData = await getSensorData(sensorLink);

        const sensorInfo = {
            thingId: thingData["@iot.id"],
            thingName: thingData.name,
            dataOrigin: "rivm",
            sensorType: sensorData.name
        };

        return { 
            sensorInfo, 
            observations: categorizeByDatastreamId(observations)
        };
    }

    return {
        getOverviewData,
        abortRequest
    };
}