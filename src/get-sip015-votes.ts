import { getOrFetchTxs } from "./get-or-fetch-txs";
import { getStackingData } from "./get-stacking-data";
import {
  AddressVote,
  ADDRESS_STX_NO,
  ADDRESS_STX_YES,
  dbgLog,
  Env,
  Sip015Vote,
  VOTE_END_BLOCK,
  VOTE_START_BLOCK,
} from "./lib/utils";

export const getSip015Votes = async (env: Env): Promise<Response> => {
  // setup vote object
  const voteTotals: Sip015Vote = {
    totalYes: 0,
    totalNo: 0,
    totalDiscardedTxs: 0,
    votes: {},
  };

  // calculate yes votes
  const yesTxList = await getOrFetchTxs(ADDRESS_STX_YES, env);
  const yesVotes = yesTxList.results.filter((tx) => {
    // discard tx that are not successful
    if (tx.tx_status !== "success") return false;
    // discard tx before the start height
    if (tx.block_height < VOTE_START_BLOCK) return false;
    // discard tx after the end height
    if (tx.block_height > VOTE_END_BLOCK) return false;
    return true;
  });
  dbgLog(`yes txs: ${yesTxList.results.length}`);
  dbgLog(`yes votes: ${yesVotes.length}`);
  const discardedYes = yesTxList.results.length - yesVotes.length;
  dbgLog(`discarded: ${discardedYes}`);
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
  const noTxList = await getOrFetchTxs(ADDRESS_STX_NO, env);
  const noVotes = noTxList.results.filter((tx) => {
    // discard tx that are not successful
    if (tx.tx_status !== "success") return false;
    // discard tx before the start height
    if (tx.block_height < VOTE_START_BLOCK) return false;
    // discard tx after the end height
    if (tx.block_height > VOTE_END_BLOCK) return false;
    return true;
  });
  dbgLog(`no txs: ${noTxList.results.length}`);
  dbgLog(`no votes: ${noVotes.length}`);
  const discardedNo = noTxList.results.length - noVotes.length;
  dbgLog(`discarded: ${discardedNo}`);
  voteTotals.totalDiscardedTxs += discardedNo;

  for (const voteTx of noVotes) {
    const voterRecord: AddressVote = {
      txid: voteTx.tx_id,
      vote: false,
    };
    voteTotals.totalNo++;
    if (voteTotals.votes[voteTx.sender_address]) {
      voteTotals.votes[voteTx.sender_address].push(voterRecord);
    } else {
      voteTotals.votes[voteTx.sender_address] = [voterRecord];
    }
  }

  // cycle through each address that voted
  for (const address in voteTotals.votes) {
    const addressVotes = voteTotals.votes[address];
    // if the address voted more than once, discard votes
    if (addressVotes.length > 1) {
      delete voteTotals.votes[address];
      voteTotals.totalDiscardedTxs += addressVotes.length;
    } else {
      // get the stacking data and add to object
      const stackingData = await getStackingData(address);
      voteTotals.votes[address][0].amountStacked = stackingData.amountStacked;
      voteTotals.votes[address][0].firstCycle = stackingData.firstCycle;
      voteTotals.votes[address][0].lockPeriod = stackingData.lockPeriod;
    }
  }

  // TODO: cache vote results in KV

  return new Response(JSON.stringify(voteTotals, null, 2));
};
