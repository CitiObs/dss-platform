import { inject } from "vue";
import { withAsync } from "@geoint/geoint-vue";

export function useSWNPApi () {
    const geoint = inject("geoint");
    const api = geoint.api("virtualair");

    let abortController = null;

    function abortRequest () {
        if (abortController) {
            // Abort the request and clear the abortController
            abortController.abort();
            abortController = null;
        }
    }

    async function getSensorDatastreams (datastreamLink) {
        //  Create a new AbortController for this request
        abortController = new AbortController();

        const params = { 
            $expand: "Observations($select=phenomenonTime,result),Thing($select=@iot.id,name),Sensor($select=name),License($select=name)", 
            $orderby: "phenomenonTime desc" ,
            $filter: "(ObservedProperty/definition eq 'http://vocabs.lter-europe.net/EnvThes/22035')",
        };

        const { response, error } = await withAsync(
            api.get,
            datastreamLink,
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

        return response.data;
    }

    async function getOverviewData (datastreamLink) {
        const datastream = await getSensorDatastreams(datastreamLink);

        if (!datastream) return;

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
            observations: datastream.Observations
        };
    }

    return {
        getOverviewData,
        abortRequest
    };
}