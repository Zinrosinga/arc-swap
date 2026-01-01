// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SimpleAMMFactory.sol";
import "./SimpleAMMPair.sol";

/**
 * @title SimpleAMMRouter
 * @notice Modernized DEX router supporting multi-hop swaps, permit, and fee-on-transfer tokens.
 */
contract SimpleAMMRouter {
    using SafeERC20 for IERC20;

    error Expired();
    error InsufficientOutputAmount();
    error ExcessiveInputAmount();
    error InvalidPath();
    error InsufficientLiquidity();
    error InsufficientInputAmount();

    address public immutable factory;

    modifier ensure(uint256 deadline) {
        if (deadline < block.timestamp) revert Expired();
        _;
    }

    constructor(address _factory) {
        factory = _factory;
    }

    // ---------------------------------------------------------------------
    // Liquidity Logic
    // ---------------------------------------------------------------------

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        address pair = SimpleAMMFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = SimpleAMMFactory(factory).createPair(tokenA, tokenB);
        }

        (uint112 reserve0, uint112 reserve1, ) = SimpleAMMPair(pair).getReserves();
        if (reserve0 == 0 && reserve1 == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            (address token0, ) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
            (uint256 resA, uint256 resB) = tokenA == token0 ? (uint256(reserve0), uint256(reserve1)) : (uint256(reserve1), uint256(reserve0));
            
            uint256 amountBOptimal = (amountADesired * resB) / resA;
            if (amountBOptimal <= amountBDesired) {
                if (amountBOptimal < amountBMin) revert InsufficientLiquidity();
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (amountBDesired * resA) / resB;
                assert(amountAOptimal <= amountADesired);
                if (amountAOptimal < amountAMin) revert InsufficientLiquidity();
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        IERC20(tokenA).safeTransferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, pair, amountB);
        liquidity = SimpleAMMPair(pair).mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = SimpleAMMFactory(factory).getPair(tokenA, tokenB);
        IERC20(pair).safeTransferFrom(msg.sender, pair, liquidity); // transfer liquidity to pair
        (uint256 amount0, uint256 amount1) = SimpleAMMPair(pair).burn(to);
        (address token0, ) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        if (amountA < amountAMin) revert InsufficientLiquidity();
        if (amountB < amountBMin) revert InsufficientLiquidity();
    }

    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external returns (uint256 amountA, uint256 amountB) {
        address pair = SimpleAMMFactory(factory).getPair(tokenA, tokenB);
        uint256 value = approveMax ? type(uint256).max : liquidity;
        SimpleAMMPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountA, amountB) = removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);
    }

    // ---------------------------------------------------------------------
    // Swap Logic
    // ---------------------------------------------------------------------

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        if (amounts[amounts.length - 1] < amountOutMin) revert InsufficientOutputAmount();
        
        address pair = SimpleAMMFactory(factory).getPair(path[0], path[1]);
        IERC20(path[0]).safeTransferFrom(msg.sender, pair, amounts[0]);
        _swap(amounts, path, to);
    }

    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = input < output ? (input, output) : (output, input);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? SimpleAMMFactory(factory).getPair(output, path[i + 2]) : _to;
            SimpleAMMPair(SimpleAMMFactory(factory).getPair(input, output)).swap(amount0Out, amount1Out, to);
        }
    }

    // ---------------------------------------------------------------------
    // Helper View Functions
    // ---------------------------------------------------------------------

    function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts) {
        if (path.length < 2) revert InvalidPath();
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            address pair = SimpleAMMFactory(factory).getPair(path[i], path[i+1]);
            (uint112 reserve0, uint112 reserve1, ) = SimpleAMMPair(pair).getReserves();
            (address token0, ) = path[i] < path[i+1] ? (path[i], path[i+1]) : (path[i+1], path[i]);
            (uint256 resIn, uint256 resOut) = path[i] == token0 ? (uint256(reserve0), uint256(reserve1)) : (uint256(reserve1), uint256(reserve0));
            amounts[i + 1] = getAmountOut(amounts[i], resIn, resOut);
        }
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
