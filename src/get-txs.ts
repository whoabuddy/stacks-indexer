import { fetchJson, StacksTxList } from "./lib/utils";

// bonus points if you use your own node
const stxApi = "https://stacks-node-api.mainnet.stacks.co";

export const getAccountTxs = async (
  principal: string,
  checkAll = false
): Promise<StacksTxList> => {
  let counter = 0;
  let limit = 50;
  let total = 0;
  let txResults = [];

  const url = new URL(
    `${stxApi}/extended/v1/address/${principal}/transactions`
  );

  do {
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", counter.toString());
    const data = await fetchJson(url.toString());
    if (total === 0) total = data.total;
    for (const tx of data.results) {
      txResults.push(tx);
      counter++;
    }
    console.log(`counter: ${counter} total: ${total}`);
  } while (checkAll && counter < total);

  const finalTxList: StacksTxList = {
    totalProcessed: counter,
    totalQueried: total,
    totalResults: txResults.length,
    lastUpdated: new Date().toISOString(),
    results: txResults,
  };
  return finalTxList;
};
