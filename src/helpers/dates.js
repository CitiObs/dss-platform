import dayjs from "@/plugins/dayjs";

export function formatUTC(date) {
    return dayjs(date).utc().format("YYYY-MM-DDTHH:mm:ss[Z]");
}

export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}-${month}-${year} ${hours}:${minutes}`;
}
