import { validateStacksAddress } from "micro-stacks/crypto";
import { dbgLog, Env, printDivider, printTimeStamp } from "./lib/utils";
import { getOrFetchTxs } from "./get-or-fetch-txs";
import { getSip015Votes } from "./get-sip015-votes";

const simpleRouter = async (request: Request, env: Env): Promise<Response> => {
  printDivider();
  const requestUrl = new URL(request.url);
  const targetAddress = requestUrl.pathname.slice(1);
  dbgLog(`path: ${requestUrl.pathname}`);

  if (requestUrl.pathname === "/") {
    dbgLog("responding with index page");
    return new Response(
      `Simple transaction indexer for Stacks, supported routes:\n
        /{principal} - returns all transactions for a given principal
        /data - returns all known keys in Cloudflare KV store
        /votes - returns compiled vote data for SIP-015
        / - returns this page`
    );
  }

  if (requestUrl.pathname === "/data") {
    dbgLog("fetching all keys from KV");
    const kvKeyList = await env.sip015_index.list();
    dbgLog("responding with all data in KV");
    return new Response(JSON.stringify(kvKeyList, null, 2));
  }

  if (requestUrl.pathname === "/votes") {
    dbgLog("responding with SIP-015 vote data");
    return await getSip015Votes(env);
  }

  if (validateStacksAddress(targetAddress)) {
    dbgLog(`getting all transactions for ${targetAddress}`);
    const txList = await getOrFetchTxs(targetAddress, env);
    dbgLog(`responding with transactions for ${targetAddress}`);
    return new Response(JSON.stringify(txList, null, 2));
  }

  dbgLog(`responding with invalid path: ${requestUrl.pathname}`);
  return new Response(
    `${targetAddress} is not a valid Stacks address or path.`,
    {
      status: 404,
    }
  );
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // return response from router
    const response = await simpleRouter(request, env);
    // create new response with CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    newResponse.headers.set("Access-Control-Max-Age", "86400");
    newResponse.headers.set("X-Stacks-Indexer", "0.0.1");
    return newResponse;
  },
};
