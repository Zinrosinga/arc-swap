// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./SimpleAMMFactory.sol";
import "./SimpleAMMPair.sol";

contract SimpleAMMRouter {
    using SafeERC20 for IERC20;

    SimpleAMMFactory public immutable factory;

    constructor(address _factory) {
        factory = SimpleAMMFactory(_factory);
    }

    // ---------------------------------------------------------------------
    // Add liquidity
    // ---------------------------------------------------------------------
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired
    )
        external
        returns (uint256 liquidity, uint256 amountA, uint256 amountB)
    {
        address pair = factory.getPair(tokenA, tokenB);
        require(pair != address(0), "PAIR_NOT_EXIST");

        // Sort tokens to match Pair's token0/token1 order
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (uint256 amount0Desired, uint256 amount1Desired) = tokenA == token0 
            ? (amountADesired, amountBDesired) 
            : (amountBDesired, amountADesired);

        IERC20(token0).safeTransferFrom(msg.sender, pair, amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, pair, amount1Desired);

        (uint256 liquidity_, uint256 amount0, uint256 amount1) =
            SimpleAMMPair(pair).addLiquidity(amount0Desired, amount1Desired, msg.sender);
        
        liquidity = liquidity_;
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
    }

    // ---------------------------------------------------------------------
    // Remove liquidity
    // ---------------------------------------------------------------------
    function removeLiquidity(address tokenA, address tokenB, uint256 liquidity)
        external
        returns (uint256 amountA, uint256 amountB)
    {
        address pair = factory.getPair(tokenA, tokenB);
        require(pair != address(0), "PAIR_NOT_EXIST");

        IERC20(pair).safeTransferFrom(msg.sender, pair, liquidity);

        (uint256 amount0, uint256 amount1) = SimpleAMMPair(pair).removeLiquidity(liquidity, msg.sender);
        (address token0,) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
    }

    // ---------------------------------------------------------------------
    // Swap
    // ---------------------------------------------------------------------
    function swapExactTokens(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin)
        external
        returns (uint256 amountOut)
    {
        address pair = factory.getPair(tokenIn, tokenOut);
        require(pair != address(0), "PAIR_NOT_EXIST");

        IERC20(tokenIn).safeTransferFrom(msg.sender, pair, amountIn);

        if (SimpleAMMPair(pair).token0() == tokenIn) {
            amountOut = SimpleAMMPair(pair).swapExactToken0ForToken1(amountIn, amountOutMin, msg.sender);
        } else {
            amountOut = SimpleAMMPair(pair).swapExactToken1ForToken0(amountIn, amountOutMin, msg.sender);
        }
    }
}

