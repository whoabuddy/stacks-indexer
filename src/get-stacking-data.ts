import { fetchReadOnlyFunction } from "micro-stacks/api";
import { principalCV } from "micro-stacks/clarity";
import {
  AddressStacking,
  POX_CONTRACT,
  POX_FUNCTION,
  STX_NETWORK,
  throttle,
} from "./lib/utils";

export const getStackingData = async (
  address: string
): Promise<AddressStacking> => {
  const stackingResponse: any = await throttle(() =>
    fetchReadOnlyFunction(
      {
        contractAddress: POX_CONTRACT.split(".")[0],
        contractName: POX_CONTRACT.split(".")[1],
        functionName: POX_FUNCTION,
        functionArgs: [principalCV(address)],
        network: STX_NETWORK,
        senderAddress: address,
      },
      true
    )
  );

  if (stackingResponse) {
    return {
      amountStacked: stackingResponse["amount-ustx"],
      firstCycle: stackingResponse["first-reward-cycle"],
      lockPeriod: stackingResponse["lock-period"],
    };
  } else {
    return {
      amountStacked: 0,
      firstCycle: 0,
      lockPeriod: 0,
    };
  }
};
