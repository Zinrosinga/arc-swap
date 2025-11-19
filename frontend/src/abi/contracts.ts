/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
import { SimpleAMMFactoryABI } from './SimpleAMMFactoryABI';
import { SimpleAMMFactoryAddresses, getFactoryAddress } from './SimpleAMMFactoryAddresses';
import { SimpleAMMRouterABI } from './SimpleAMMRouterABI';
import { SimpleAMMRouterAddresses, getRouterAddress } from './SimpleAMMRouterAddresses';
import { SimpleAMMPairABI } from './SimpleAMMPairABI';
import { AMMPairs, getPairKey } from './AMMPairs';

export const ABIs = {
  SimpleAMMFactory: SimpleAMMFactoryABI.abi,
  SimpleAMMRouter: SimpleAMMRouterABI.abi,
  SimpleAMMPair: SimpleAMMPairABI.abi,
};

export const Addresses = {
  SimpleAMMFactory: SimpleAMMFactoryAddresses,
  SimpleAMMRouter: SimpleAMMRouterAddresses,
};

export { SimpleAMMFactoryABI, SimpleAMMFactoryAddresses, getFactoryAddress };
export { SimpleAMMRouterABI, SimpleAMMRouterAddresses, getRouterAddress };
export { SimpleAMMPairABI };
export { AMMPairs, getPairKey };

export const ARC_TESTNET_CHAIN_ID = 5042002;

export function getDexAddresses(chainId: number = ARC_TESTNET_CHAIN_ID) {
  return {
    factory: getFactoryAddress(chainId),
    router: getRouterAddress(chainId),
  };
}
