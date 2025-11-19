// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SimpleAMMPair.sol";

contract SimpleAMMFactory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    address public immutable owner;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 index);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(getPair[token0][token1] == address(0), "PAIR_EXISTS");

        pair = address(new SimpleAMMPair(token0, token1));
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}

