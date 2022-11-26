import throttledQueue from "throttled-queue";
import { Transaction } from "@stacks/stacks-blockchain-api-types";
import { StacksMainnet } from "micro-stacks/network";

/////////////////////////
// CONSTANTS
/////////////////////////

// logging config
const ENABLE_LOGS = true;

// stacks helpers
export const POX_CONTRACT = "SP000000000000000000002Q6VF78.pox";
export const POX_FUNCTION = "get-stacker-info";
export const STX_NETWORK = new StacksMainnet();
export const STX_API = "https://stacks-node-api.mainnet.stacks.co";

// sip015 helpers
export const ADDRESS_STX_YES = "SP00000000000003SCNSJTCHE66N2PXHX";
export const ADDRESS_STX_NO = "SP00000000000000DSQJTCHE66XE1NHQ";
export const VOTE_START_BLOCK = 82914;
export const VOTE_END_BLOCK = 87114;

/////////////////////////
// HELPERS
/////////////////////////

// print helpers
export const dbgLog = (msg: string) => ENABLE_LOGS && console.log(msg);
export const printDivider = () => console.log(`------------------------------`);
export const printTimeStamp = () => {
  let newDate = new Date().toLocaleString();
  newDate = newDate.replace(/,/g, "");
  console.log(newDate);
};

// async sleep timer
export const sleep = (ms: number) => {
  console.log(`sleeping for ${ms} milliseconds`);
  return new Promise((resolve) => setTimeout(resolve, ms, undefined));
};

// generic queue throttled to 1 request per second
export const throttle = throttledQueue(1, 1000, true);

// fetch and return JSON from URL
export const fetchJson = async (url: string): Promise<any> => {
  dbgLog(`fetchJson: ${url}`);
  const response = await throttle(() => fetch(url));
  if (response.status === 200) {
    const json = await response.json();
    return json;
  }
  throw new Error(
    `fetchJson: ${url} ${response.status} ${response.statusText}`
  );
};

/////////////////////////
// INTERFACES
/////////////////////////

// interface for KV binding
export interface Env {
  // KV binding
  sip015_index: KVNamespace;
}

// interface for kv metadata
export interface StacksTxKvMetadata {
  totalProcessed: number;
  totalQueried: number;
  totalResults: number;
  lastUpdated: string;
}

// interface for aggregating TX responses
// TODO: make an array of stacks tx results
export interface StacksTxList extends StacksTxKvMetadata {
  results: Array<Transaction>;
}

// interface for overall voting record
export interface Sip015Vote {
  totalYes: number;
  totalNo: number;
  totalDiscardedTxs: number;
  votes: {
    [key: string]: AddressVote[];
  };
}

// interface for stacking data
export interface AddressStacking {
  amountStacked?: number;
  firstCycle?: number;
  lockPeriod?: number;
}

// interface for individual address voting record
export interface AddressVote extends AddressStacking {
  txid: string;
  vote: boolean;
}
