import { validateStacksAddress } from "micro-stacks/crypto";
import { getAccountTxs } from "./get-txs";
import { StacksTxKvMetadata } from "./lib/utils";

export interface Env {
  // KV binding
  sip015_index: KVNamespace;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const requestUrl = new URL(request.url);
    const targetAddress = requestUrl.pathname.slice(1);
    console.log(`path: ${requestUrl.pathname}`);

    if (requestUrl.pathname === "/") {
      return new Response(
        `Simple transaction indexer for Stacks, supported routes:\n
        /{principal} - returns all transactions for a given principal
        /data - returns all known keys in Cloudflare KV store
        / - returns this page`
      );
    }

    if (requestUrl.pathname === "/data") {
      const kvKeyList = await env.sip015_index.list();
      return new Response(JSON.stringify(kvKeyList, null, 2));
    }

    if (validateStacksAddress(targetAddress)) {
      // get transaction data from KV if it exists
      const { value, metadata } = await env.sip015_index.getWithMetadata(
        targetAddress,
        {
          type: "json",
        }
      );

      // if it exists, check against current API total
      if (value && metadata) {
        console.log(`found in KV: ${targetAddress}`);
        // get the current total transactions from the API
        const apiTxList = await getAccountTxs(targetAddress, false);
        const apiTotal = apiTxList.totalQueried;
        // if the total is the same, return the cached data
        if (apiTotal === (metadata as StacksTxKvMetadata).totalQueried) {
          console.log(`totals match, responding with KV data`);
          const txList = {
            ...metadata,
            results: value,
          };
          return new Response(JSON.stringify(txList, null, 2));
        }
        console.log(`totals do not match, fetching fresh data from API`);
      }

      // otherwise, fetch all TX from API and store in KV
      const txList = await getAccountTxs(requestUrl.pathname, true);
      await env.sip015_index.put(
        targetAddress,
        JSON.stringify(txList.results),
        {
          metadata: {
            totalProcessed: txList.totalProcessed,
            totalQueried: txList.totalQueried,
            totalResults: txList.totalResults,
            lastUpdated: txList.lastUpdated,
          },
        }
      );
      return new Response(JSON.stringify(txList, null, 2));
    }

    return new Response(`${targetAddress} is not a valid Stacks address.`, {
      status: 500,
    });
  },
};
