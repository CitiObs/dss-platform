import { inject } from "vue";
import { withAsync } from "@geoint/geoint-vue";

export function useSWNPApi () {
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

    async function getSensorObservations (observationsLink) {
        // Create a new AbortController for this request
        abortController = new AbortController();

        const params = { $expand: "Datastream($expand=Thing,Sensor,License)" };
    
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

        const datastream = observations[0].Datastream;

        const sensorInfo = {
            thingId: datastream.Thing["@iot.id"],
            thingName: datastream.Thing.name,
            dataOrigin: "citiobs_demo",
            license: datastream.License.name
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