import { validateStacksAddress } from "micro-stacks/crypto";
import { getAccountTxs } from "./get-txs";
import {
  AddressVote,
  Sip015Vote,
  StacksTxKvMetadata,
  StacksTxList,
} from "./lib/utils";

export interface Env {
  // KV binding
  sip015_index: KVNamespace;
}

async function simpleRouter(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const targetAddress = requestUrl.pathname.slice(1);
  console.log(`path: ${requestUrl.pathname}`);

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
    return await calculateVotes(requestUrl, env);
  }

  if (validateStacksAddress(targetAddress)) {
    const txList = await getOrFetchTxs(requestUrl, targetAddress, env);
    return new Response(JSON.stringify(txList, null, 2));
  }

  return new Response(`${targetAddress} is not a valid Stacks address.`, {
    status: 404,
  });
}

async function getOrFetchTxs(
  requestUrl: URL,
  targetAddress: string,
  env: Env
): Promise<StacksTxList> {
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
  const txList = await getAccountTxs(requestUrl.pathname, true);
  await env.sip015_index.put(targetAddress, JSON.stringify(txList.results), {
    metadata: {
      totalProcessed: txList.totalProcessed,
      totalQueried: txList.totalQueried,
      totalResults: txList.totalResults,
      lastUpdated: txList.lastUpdated,
    },
  });
  return txList;
}

async function calculateVotes(requestUrl: URL, env: Env): Promise<Response> {
  const ADDRESS_STX_YES = "SP00000000000003SCNSJTCHE66N2PXHX";
  const ADDRESS_STX_NO = "SP00000000000000DSQJTCHE66XE1NHQ";
  const VOTE_START_BLOCK = 82914;
  const VOTE_END_BLOCK = 87114;

  // setup vote object
  const voteTotals: Sip015Vote = {
    totalYes: 0,
    totalNo: 0,
    totalDiscardedTxs: 0,
    votes: {},
  };

  // calculate yes votes
  const yesTxList = await getOrFetchTxs(requestUrl, ADDRESS_STX_YES, env);
  const yesVotes = yesTxList.results.filter((tx) => {
    // discard tx that are not successful
    if (tx.tx_status !== "success") return false;
    // discard tx before the start height
    if (tx.block_height < VOTE_START_BLOCK) return false;
    // discard tx after the end height
    if (tx.block_height > VOTE_END_BLOCK) return false;
    return true;
  });
  console.log(`yes txs: ${yesTxList.results.length}`);
  console.log(`yes votes: ${yesVotes.length}`);
  const discardedYes = yesTxList.results.length - yesVotes.length;
  console.log(`discarded: ${discardedYes}`);
  voteTotals.totalDiscardedTxs += discardedYes;

  for (const voteTx of yesVotes) {
    const voterRecord: AddressVote = {
      txid: voteTx.tx_id,
      vote: true,
      amountStacked: 0, // TODO
    };
    voteTotals.totalYes++;
    if (voteTotals.votes[voteTx.sender_address]) {
      voteTotals.votes[voteTx.sender_address].push(voterRecord);
    } else {
      voteTotals.votes[voteTx.sender_address] = [voterRecord];
    }
  }

  // calculate no votes
  const noTxList = await getOrFetchTxs(requestUrl, ADDRESS_STX_NO, env);
  const noVotes = noTxList.results.filter((tx) => {
    // discard tx that are not successful
    if (tx.tx_status !== "success") return false;
    // discard tx before the start height
    if (tx.block_height < VOTE_START_BLOCK) return false;
    // discard tx after the end height
    if (tx.block_height > VOTE_END_BLOCK) return false;
    return true;
  });
  console.log(`no txs: ${noTxList.results.length}`);
  console.log(`no votes: ${noVotes.length}`);
  const discardedNo = noTxList.results.length - noVotes.length;
  console.log(`discarded: ${discardedNo}`);
  voteTotals.totalDiscardedTxs += discardedNo;

  for (const voteTx of noVotes) {
    const voterRecord: AddressVote = {
      txid: voteTx.tx_id,
      vote: false,
      amountStacked: 0, // TODO
    };
    voteTotals.totalNo++;
    if (voteTotals.votes[voteTx.sender_address]) {
      voteTotals.votes[voteTx.sender_address].push(voterRecord);
    } else {
      voteTotals.votes[voteTx.sender_address] = [voterRecord];
    }
  }

  // discard tx that occur more than once per user
  // need getter for stacked amounts - one cycle total?
  // cache vote results in KV

  return new Response(JSON.stringify(voteTotals, null, 2));
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // return response from router
    const response = await simpleRouter(request, env);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    newResponse.headers.set("Access-Control-Max-Age", "86400");
    newResponse.headers.set("X-Stacks-Indexer", "0.0.1");
    return newResponse;
  },
};
