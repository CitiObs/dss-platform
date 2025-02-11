import { GeoJSON } from "ol/format";

class Point {
    constructor(lon, lat) {
        this.lon = lon;
        this.lat = lat;
    }

    toWKT() {
        return `POINT(${this.lon} ${this.lat})`;
    }

    toGeoJSON() {
        const geojson = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Point",
                        coordinates: [this.lon, this.lat],
                    },
                },
            ],
        };
        return geojson;
    }

    toFeatures(projection = "EPSG:3857") {
        // console.log("toFeatures", this.toGeoJSON());
        const features = new GeoJSON().readFeatures(this.toGeoJSON(), { featureProjection: projection });
        return features;
    }
}

export class Extent {
    constructor(west, north, east, south) {
        this.west = west;
        this.north = north;
        this.east = east;
        this.south = south;
        this.width = east - west;
        this.height = north - south;
    }

    getCenter() {
        return new Point(this.west + this.width / 2, this.south + this.height / 2);
    }

    toWKT() {
        return `POLYGON((${this.west} ${this.north}, ${this.east} ${this.north}, ${this.east} ${this.south}, ${this.west} ${this.south}, ${this.west} ${this.north}))`;
    }

    toGeoJSON() {
        const geojson = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Polygon",
                        coordinates: [
                            [
                                [this.west, this.north],
                                [this.east, this.north],
                                [this.east, this.south],
                                [this.west, this.south],
                                [this.west, this.north],
                            ],
                        ],
                    },
                },
            ],
        };
        return geojson;
    }
}

/**
 * Converts the longitude to a OSM tile number
 * @param lon longitude
 * @param zoom current zoom level
 * @returns OSM tile number
 */
function long2tile(lon, zoom) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

/**
 * Converts the latitude to a OSM tile number
 * @param lat latitude
 * @param zoom current zoom level
 * @returns OSM tile number
 */
function lat2tile(lat, zoom) {
    return Math.floor(
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
            Math.pow(2, zoom)
    );
}

/**
 * OSM tile number to the upper left longitude
 * @param x osm tile number
 * @param z osm tile number
 * @returns longitude of upper right point of the OSM tile
 */
function tile2long(x, z) {
    return (x / Math.pow(2, z)) * 360 - 180;
}

/**
 * OSM tile number to the upper left latitude
 * @param x osm tile number
 * @param z osm tile number
 * @returns latitude of upper right point of the OSM tile
 */
function tile2lat(y, z) {
    var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function extentToTiles(extent, zoom) {
    const west = long2tile(extent.west, zoom);
    const east = long2tile(extent.east, zoom);
    const north = lat2tile(extent.north, zoom);
    const south = lat2tile(extent.south, zoom);
    return new Extent(west, north, east, south);
}

function tileToExtent(x, y, zoom) {
    const west = tile2long(x, zoom);
    const north = tile2lat(y, zoom);
    const east = tile2long(x + 1, zoom);
    const south = tile2lat(y + 1, zoom);
    return new Extent(west, north, east, south);
}

class Grid {
    constructor() {
        this.cells = [];
    }

    push(extent) {
        this.cells.push(extent);
    }

    toWKT() {
        let wkt = "GEOMETRYCOLLECTION (" + this.cells.map((item) => item.toWKT()).join(", ") + ")";
        return wkt;
    }

    toGeoJSON() {
        const geojson = {
            type: "FeatureCollection",
            features: [],
        };

        for (let cell of this.cells) {
            const feature = cell.toGeoJSON().features[0];
            geojson.features.push(feature);
        }

        return geojson;
    }

    toFeatures(projection = "EPSG:3857") {
        const features = new GeoJSON().readFeatures(this.toGeoJSON(), { featureProjection: projection });
        return features;
    }

    [Symbol.iterator]() {
        let index = 0;

        return {
            next: () => {
                if (index < this.cells.length) {
                    const cell = this.cells[index];
                    index++;
                    return { value: cell, done: false };
                } else {
                    return { done: true };
                }
            },
        };
    }
}

export function generateGrid(extent, zoom) {
    const tilesExtent = extentToTiles(extent, zoom);
    const grid = new Grid();
    for (let y = tilesExtent.north; y <= tilesExtent.south; y++) {
        for (let x = tilesExtent.west; x <= tilesExtent.east; x++) {
            const extent = tileToExtent(x, y, zoom);
            grid.push(extent);
        }
    }
    return grid;
}
