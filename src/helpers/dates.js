import dayjs from "@/plugins/dayjs";

export function formatUTC(date) {
    return dayjs(date).utc().format("YYYY-MM-DDTHH:mm:ss[Z]");
}
