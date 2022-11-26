import { validateStacksAddress } from "micro-stacks/crypto";
import { dbgLog, Env } from "./lib/utils";
import { getOrFetchTxs } from "./get-or-fetch-txs";
import { getSip015Votes } from "./get-sip015-votes";

const simpleRouter = async (request: Request, env: Env): Promise<Response> => {
  const requestUrl = new URL(request.url);
  const targetAddress = requestUrl.pathname.slice(1);
  dbgLog(`path: ${requestUrl.pathname}`);

  if (requestUrl.pathname === "/") {
    return new Response(
      `Simple transaction indexer for Stacks, supported routes:\n
        /{principal} - returns all transactions for a given principal
        /data - returns all known keys in Cloudflare KV store
        /votes - returns compiled vote data for SIP-015
        / - returns this page`
    );
  }

  if (requestUrl.pathname === "/data") {
    const kvKeyList = await env.sip015_index.list();
    return new Response(JSON.stringify(kvKeyList, null, 2));
  }

  if (requestUrl.pathname === "/votes") {
    return await getSip015Votes(env);
  }

  if (validateStacksAddress(targetAddress)) {
    const txList = await getOrFetchTxs(targetAddress, env);
    return new Response(JSON.stringify(txList, null, 2));
  }

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
