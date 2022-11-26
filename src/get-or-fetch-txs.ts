import { getAccountTxs } from "./get-account-txs";
import { Env, StacksTxKvMetadata, StacksTxList } from "./lib/utils";

export const getOrFetchTxs = async (
  targetAddress: string,
  env: Env
): Promise<StacksTxList> => {
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
        ...(metadata as StacksTxKvMetadata),
        results: value as StacksTxList["results"],
      };
      return txList;
    }
    console.log(`totals do not match, fetching fresh data from API`);
  }

  // otherwise, fetch all TX from API and store in KV
  const txList = await getAccountTxs(targetAddress, true);
  await env.sip015_index.put(targetAddress, JSON.stringify(txList.results), {
    metadata: {
      totalProcessed: txList.totalProcessed,
      totalQueried: txList.totalQueried,
      totalResults: txList.totalResults,
      lastUpdated: txList.lastUpdated,
    },
  });
  return txList;
};
