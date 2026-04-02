# Map Sensor Loading – Investigation Task

## Context

The application displays environmental sensor stations on a world map.

Each station is represented as a marker on the map and is associated with one or more **Datastreams** containing observations (e.g. temperature, humidity, UV, etc.).

The data is retrieved from a **SensorThings API** endpoint:

https://api-virtualair.nilu.no/v1.1/

The map currently supports:

-   zooming
-   panning
-   clustering of sensors
-   displaying individual sensor markers
-   showing the latest observation value

However, the current implementation produces a poor user experience due to excessive requests and unstable marker rendering.

This document describes the **current behavior**, **request patterns**, and **observed problems**.

Your task is to **analyze the system and investigate possible improvements**.

Do not assume backend changes are possible.

---

# Important Constraint

We **do not have access to the backend**.

The API is external and cannot be modified.

All improvements must therefore be implemented **client-side only**.

---

# Current Map Architecture

The map loads sensors dynamically depending on the current viewport.

The process is roughly:

1. The user moves or zooms the map
2. The visible map extent is converted to geographic coordinates
3. The extent is divided into grid cells
4. Each grid cell triggers a request to the SensorThings API
5. The API returns sensor metadata
6. Additional requests are made to retrieve observations for each datastream

This results in multiple layers of API requests.

---

# Example Request – Fetching Sensors in a Region

Sensors are retrieved using a spatial query with `st_within`.

Example request:

https://api-virtualair.nilu.no/v1.1/Things?$expand=Datastreams/ObservedProperty($select=definition),Locations($select=location)&$filter=st_within(Locations/location, geography'POLYGON((41.60 13.66,97.00 13.66,97.00 -38.36,41.60 -38.36,41.60 13.66))') and Datastreams/ObservedProperty/definition eq 'http://vocabs.lter-europe.net/EnvThes/22035'&$count=true&$top=0

Example response:

{
"value": [],
"@iot.count": 6777
}

This response indicates how many sensors exist in the queried region.

---

# Example Request – Fetching Sensors with Details

When the number of sensors in a region is small enough, the application fetches the full sensor objects.

Example response fragment:

{
"@iot.id": "SWNP_27",
"name": "FT-0310 Weather Station",
"Datastreams": [
{
"@iot.id": "SWNP_116",
"name": "Air Temperature",
"ObservedProperty": {
"definition": "http://vocabs.lter-europe.net/EnvThes/22035"
}
}
],
"Locations": [
{
"location": {
"type": "Point",
"coordinates": [41.727019, 1.840937]
}
}
]
}

Each object corresponds to a sensor station that can be rendered as a marker on the map.

---

# Example Request – Fetching Latest Observation

Once a sensor is displayed, the system retrieves the latest observation for its datastream.

Example request:

https://api-virtualair.nilu.no/v1.1/Datastreams(KNJV_2365)?$expand=Observations($orderby=phenomenonTime desc;$top=1)&$select=Observations/result

Example response:

{
"Observations": [
{
"@iot.id": "KNJV_1928840",
"phenomenonTime": "2024-07-12T17:30:00Z",
"result": -99
}
]
}

In some cases the datastream returns no observations:

{
"Observations": []
}

---

# Observed Network Behavior

When the user performs a simple zoom operation:

-   multiple grid cells are generated
-   each grid cell triggers an API request
-   each sensor may trigger additional observation requests

As a result, a single map interaction can produce **many network requests**.

In the browser network panel it is common to see:

-   many `Things` requests
-   many `Datastreams` requests
-   some responses returning empty results

---

# Observed UX Problems

The following user experience issues are observed:

### Marker Flickering

Markers disappear while new requests are executed and reappear once responses arrive.

This makes the map appear unstable during zooming.

---

### Changing Cluster Counts

Cluster numbers can change dramatically when zooming.

Example sequence:

zoom level → 6777 sensors
zoom level → 300 sensors
zoom level → 80 sensors

This can appear confusing to users.

---

### Large Number of Requests

A simple map movement can generate many API requests.

Some of these requests return empty results or very small datasets.

---

### Delayed Marker Rendering

Markers may appear with a noticeable delay while observation requests complete.

---

# Current Data Model

Each sensor is represented by a **Thing**.

Each Thing contains:

-   Locations
-   Datastreams
-   ObservedProperty definitions

Observations are retrieved separately via Datastream requests.

---

# What Needs Investigation

The current architecture produces a large number of requests and inconsistent map behavior.

Your task is to analyze the current approach and investigate potential improvements.

Areas that may require investigation include:

-   request patterns
-   caching strategies
-   clustering strategies
-   observation loading strategies
-   map interaction handling
-   API query optimization
-   frontend architecture

You are encouraged to study the current request flow and propose potential optimizations that improve:

-   performance
-   responsiveness
-   stability of markers
-   network efficiency

Backend modifications are **not possible**, so all proposals must assume the API remains unchanged.

---

# Expected Outcome

Analyze the current behavior and propose improvements that could reduce:

-   the number of network requests
-   loading latency
-   marker flickering
-   inconsistent cluster behavior

Provide recommendations and possible implementation strategies that can be applied on the frontend.
