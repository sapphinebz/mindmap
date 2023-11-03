import { fromFetch } from "rxjs/fetch";

export function httpPost(url, payload) {
  return fromFetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },

    selector: (res) => res.json(),
  });
}

export function httpGet(url) {
  return fromFetch(url, {
    method: "GET",

    selector: (res) => res.json(),
  });
}
