import throttledQueue from "throttled-queue";
import { Transaction } from "@stacks/stacks-blockchain-api-types";

// logging config
const ENABLE_LOGS = false;
export const dbgLog = (msg: string) => ENABLE_LOGS && console.log(msg);

// print helpers
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

// throttle to 1 requests per second
const throttle = throttledQueue(1, 1000, true);

// fetch and return JSON from URL
export const fetchJson = async (url: string): Promise<any> => {
  dbgLog(`fetchJson: ${url}`);
  const response = await throttle(() => fetch(url));
  if (response.status === 200) {
    const json = await response.json();
    dbgLog(`fetchJson: ${JSON.stringify(json)}`);
    return json;
  }
  throw new Error(
    `fetchJson: ${url} ${response.status} ${response.statusText}`
  );
};

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

// interface for individual address voting record
export interface AddressVote {
  amountStacked: number;
  txid: string;
  vote: boolean;
}
